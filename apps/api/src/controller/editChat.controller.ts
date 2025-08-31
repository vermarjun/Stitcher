import { Request, Response } from 'express';
import Project from '../model/project.model';
import EditChat from '../model/editChat.model';
import Timeline from '../model/timeline.model';
import Track from '../model/track.model';
import TimelineItem from '../model/timelineitem.model';
import { Types } from 'mongoose';

// Interface for the microservice request
interface MicroserviceRequest {
  prompt: string;
  timelineObject: any;
}

// Interface for the microservice response
interface MicroserviceResponse {
  updatedTimelineObject: any;
  llmResponse: string;
  success: boolean;
  error?: string;
}

// Function to call the microservice
async function callTimelineEditMicroservice(request: MicroserviceRequest): Promise<MicroserviceResponse> {
  try {
    // Validate environment variables
    // if (!process.env.TIMELINE_EDIT_MICROSERVICE_URL) {
    //   throw new Error('TIMELINE_EDIT_MICROSERVICE_URL is not configured');
    // }

    // const response = await fetch(process.env.TIMELINE_EDIT_MICROSERVICE_URL, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     ...(process.env.MICROSERVICE_API_KEY && {
    //       'Authorization': `Bearer ${process.env.MICROSERVICE_API_KEY}`
    //     })
    //   },
    //   body: JSON.stringify(request)
    // });

    const response = {
      updatedTimelineObject: request.timelineObject,
      llmResponse: "hey I have updated the timeline",
      success: true,
      error: "Fuck no error"
    }

    if (!response.success) {
      throw new Error(`Microservice responded with status: ${response.error}`);
    }

    return response;
  } catch (error) {
    console.error('Error calling timeline edit microservice:', error);
    return {
      updatedTimelineObject: null,
      llmResponse: 'Sorry, I encountered an error while processing your request. Please try again.',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Function to get complete timeline object with all related data
async function getCompleteTimelineObject(timelineId: Types.ObjectId) {
  try {
    const timeline = await Timeline.findById(timelineId).lean();
    if (!timeline) {
      throw new Error('Timeline not found');
    }

    // Get all tracks for this timeline
    const tracks = await Track.find({ timelineId }).lean();
    
    // Get all timeline items for these tracks
    const trackIds = tracks.map(track => track._id);
    const timelineItems = await TimelineItem.find({ 
      trackId: { $in: trackIds } 
    }).lean();

    // Organize timeline items by track
    const tracksWithItems = tracks.map(track => ({
      ...track,
      items: timelineItems.filter(item => 
        item.trackId.toString() === track._id.toString()
      )
    }));

    return {
      ...timeline,
      tracks: tracksWithItems
    };
  } catch (error) {
    console.error('Error getting complete timeline object:', error);
    throw error;
  }
}

// Function to update timeline in database based on the microservice response
async function updateTimelineInDatabase(timelineId: Types.ObjectId, updatedTimelineObject: any) {
  try {
    // Update the timeline document itself
    const { tracks, ...timelineData } = updatedTimelineObject;
    await Timeline.findByIdAndUpdate(timelineId, timelineData);

    // Handle tracks and timeline items updates
    if (tracks && Array.isArray(tracks)) {
      for (const trackData of tracks) {
        const { items, ...trackInfo } = trackData;
        
        // Update or create track
        let track;
        if (trackData._id) {
          track = await Track.findByIdAndUpdate(trackData._id, trackInfo, { new: true });
        } else {
          track = await Track.create({ ...trackInfo, timelineId });
        }

        if (!track) {
          throw new Error('Failed to create or update track');
        }

        // Handle timeline items
        if (items && Array.isArray(items)) {
          // Remove existing items for this track
          await TimelineItem.deleteMany({ trackId: track._id });
          
          // Create new items
          const itemsToCreate = items.map(item => ({
            ...item,
            trackId: track._id,
            _id: undefined // Remove _id to let MongoDB generate new ones
          }));
          
          if (itemsToCreate.length > 0) {
            await TimelineItem.insertMany(itemsToCreate);
          }
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Error updating timeline in database:', error);
    throw error;
  }
}

// Controller function to handle edit chat requests
export const processEditChat = async (req: Request, res: Response) => {
  try {
    const { projectId, prompt } = req.body;

    // Validate request
    if (!projectId || !prompt) {
      return res.status(400).json({
        success: false,
        error: 'Project ID and prompt are required'
      });
    }

    // Validate projectId format
    if (!Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid project ID format'
      });
    }

    // Find the project and ensure it has an edit chat and timeline
    const project = await Project.findById(projectId).populate('timeline edit_chat');
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    if (!project.timeline) {
      return res.status(400).json({
        success: false,
        error: 'Project does not have a timeline'
      });
    }

    // Get the complete timeline object
    const timelineObject = await getCompleteTimelineObject(project.timeline as Types.ObjectId);

    // Prepare microservice request
    const microserviceRequest: MicroserviceRequest = {
      prompt,
      timelineObject
    };

    // Call the microservice
    const microserviceResponse = await callTimelineEditMicroservice(microserviceRequest);

    if (!microserviceResponse.success) {
      return res.status(500).json({
        success: false,
        error: microserviceResponse.error || 'Failed to process timeline edit',
        llmResponse: microserviceResponse.llmResponse
      });
    }

    // Update the timeline in the database
    if (microserviceResponse.updatedTimelineObject) {
      await updateTimelineInDatabase(
        project.timeline as Types.ObjectId, 
        microserviceResponse.updatedTimelineObject
      );
    }

    // Ensure edit chat exists
    let editChat;
    if (project.edit_chat) {
      editChat = await EditChat.findById(project.edit_chat);
    } else {
      editChat = await EditChat.create({ messages: [] });
      project.edit_chat = editChat._id as Types.ObjectId;
      await project.save();
    }

    if (!editChat) {
      throw new Error('Failed to create or retrieve edit chat');
    }

    // Add user message to chat
    editChat.messages.push({
      role: 'user',
      content: prompt,
      timestamp: new Date(),
      timelineObject: timelineObject // Store current state for rollback
    });

    // Add assistant response to chat
    editChat.messages.push({
      role: 'assistant',
      content: microserviceResponse.llmResponse,
      timestamp: new Date(),
      timelineObject: microserviceResponse.updatedTimelineObject // Store updated state
    });

    await editChat.save();

    // Return success response
    res.json({
      success: true,
      llmResponse: microserviceResponse.llmResponse,
      updatedTimelineObject: microserviceResponse.updatedTimelineObject,
      chatId: editChat._id
    });

  } catch (error) {
    console.error('Error in processEditChat:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Controller function to get edit chat history
export const getEditChatHistory = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    // Validate projectId format
    if (!Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid project ID format'
      });
    }

    const project = await Project.findById(projectId).populate('edit_chat');
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    if (!project.edit_chat) {
      return res.json({
        success: true,
        messages: [],
        chatId: null
      });
    }

    const editChat = await EditChat.findById(project.edit_chat);
    
    res.json({
      success: true,
      messages: editChat?.messages || [],
      chatId: editChat?._id
    });

  } catch (error) {
    console.error('Error in getEditChatHistory:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Controller function to rollback to a previous timeline state
export const rollbackTimeline = async (req: Request, res: Response) => {
  try {
    const { projectId, messageIndex } = req.body;

    // Validate request
    if (!projectId || messageIndex === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Project ID and message index are required'
      });
    }

    // Validate projectId format
    if (!Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid project ID format'
      });
    }

    // Validate messageIndex
    if (typeof messageIndex !== 'number' || messageIndex < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid message index'
      });
    }

    const project = await Project.findById(projectId).populate('edit_chat timeline');
    if (!project || !project.edit_chat || !project.timeline) {
      return res.status(404).json({
        success: false,
        error: 'Project, edit chat, or timeline not found'
      });
    }

    const editChat = await EditChat.findById(project.edit_chat);
    if (!editChat || !editChat.messages[messageIndex]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid message index or message not found'
      });
    }

    const targetMessage = editChat.messages[messageIndex];
    if (!targetMessage.timelineObject) {
      return res.status(400).json({
        success: false,
        error: 'No timeline state available for this message'
      });
    }

    // Restore the timeline to the selected state
    await updateTimelineInDatabase(
      project.timeline as Types.ObjectId, 
      targetMessage.timelineObject
    );

    res.json({
      success: true,
      message: 'Timeline rolled back successfully',
      timelineObject: targetMessage.timelineObject
    });

  } catch (error) {
    console.error('Error in rollbackTimeline:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};