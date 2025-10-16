import { Request, Response } from 'express';
import ApiKey from "../model/userapikeys.model";
import { Types } from 'mongoose';

interface AuthenticatedRequest extends Request {
  userId?: string;
}

const AGENT_DEFINITIONS = {
  general: "General Purpose Agent",
  coder: "Coder",
  reviewer: "Code Reviewer",
  debugger: "Debugger",
  planner: "Planner",
  optimizer: "Code Optimizer"
};

// Get all API keys for a user
export const getUserApiKeys = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const apiKeys = await ApiKey.find({ userId: new Types.ObjectId(userId) });
    
    // Transform for frontend - include baseUrl and modelName
    const keysData: Record<string, { keyValue: string; baseUrl: string; modelName: string }> = {};
    apiKeys.forEach(key => {
      if (key.isActive) {
        // Mask the API key for security - show first 4 chars, ****, last 2 chars
        const maskedKey = key.keyValue.length > 6 
          ? `${key.keyValue.substring(0, 5)}*********************************${key.keyValue.substring(key.keyValue.length - 5)}`
          : '****'; // Fallback for very short keys
        
        keysData[key.agentId] = {
          keyValue: maskedKey,
          baseUrl: key.baseUrl,
          modelName: key.modelName
        };
      }
    });

    res.json({ apiKeys: keysData });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Save/Update API keys
export const saveApiKeys = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { apiKeys } = req.body;
    
    if (!apiKeys || typeof apiKeys !== 'object') {
      return res.status(400).json({ message: 'Invalid API keys data' });
    }

    const operations = [];

    // Process each agent
    for (const [agentId, keyData] of Object.entries(apiKeys)) {
      if (typeof keyData === 'object' && keyData !== null) {
        const { keyValue, baseUrl, modelName } = keyData as any;
        
        if (keyValue && typeof keyValue === 'string' && keyValue.trim() !== '' &&
            baseUrl && typeof baseUrl === 'string' && baseUrl.trim() !== '' &&
            modelName && typeof modelName === 'string' && modelName.trim() !== '') {
          operations.push({
            updateOne: {
              filter: { userId: new Types.ObjectId(userId), agentId },
              update: {
                $set: {
                  keyValue: keyValue.trim(),
                  baseUrl: baseUrl.trim(),
                  modelName: modelName.trim(),
                  agentName: AGENT_DEFINITIONS[agentId as keyof typeof AGENT_DEFINITIONS],
                  isActive: true,
                  updatedAt: new Date()
                },
                $setOnInsert: {
                  userId: new Types.ObjectId(userId),
                  agentId
                }
              },
              upsert: true
            }
          });
        } else {
          // If any required field is empty, deactivate it
          operations.push({
            updateOne: {
              filter: { userId: new Types.ObjectId(userId), agentId },
              update: {
                $set: {
                  isActive: false,
                  updatedAt: new Date()
                }
              }
            }
          });
        }
      }
    }

    if (operations.length > 0) {
      await ApiKey.bulkWrite(operations);
    }

    res.json({ 
      message: 'API keys saved successfully',
      saved: operations.length 
    });
  } catch (error) {
    console.error('Error saving API keys:', error);
    res.status(500).json({ message: 'Failed to save API keys' });
  }
};

// Get API key for a specific agent (for internal use)
export const getApiKeyForAgent = async (userId: string, agentId: string): Promise<{keyValue: string; baseUrl: string; modelName: string} | null> => {
  try {
    const apiKey = await ApiKey.findOne({ 
      userId: new Types.ObjectId(userId), 
      agentId,
      isActive: true 
    });

    if (apiKey) {
      return {
        keyValue: apiKey.keyValue,
        baseUrl: apiKey.baseUrl,
        modelName: apiKey.modelName
      };
    }

    // If specific agent key not found, try to get general key as fallback
    if (agentId !== 'general') {
      const generalKey = await ApiKey.findOne({ 
        userId: new Types.ObjectId(userId), 
        agentId: 'general',
        isActive: true 
      });
      return generalKey ? {
        keyValue: generalKey.keyValue,
        baseUrl: generalKey.baseUrl,
        modelName: generalKey.modelName
      } : null;
    }

    return null;
  } catch (error) {
    console.error('Error getting API key for agent:', error);
    return null;
  }
};

// Get specific API key details
export const getApiKeyDetails = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { agentId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const apiKey = await ApiKey.findOne({ 
      userId: new Types.ObjectId(userId), 
      agentId 
    });

    if (!apiKey) {
      return res.status(404).json({ message: 'API key not found' });
    }

    res.json({
      agentId: apiKey.agentId,
      agentName: apiKey.agentName,
      keyValue: apiKey.isActive ? apiKey.keyValue : '',
      baseUrl: apiKey.isActive ? apiKey.baseUrl : '',
      modelName: apiKey.isActive ? apiKey.modelName : '',
      isActive: apiKey.isActive,
      createdAt: apiKey.createdAt,
      updatedAt: apiKey.updatedAt
    });
  } catch (error) {
    console.error('Error fetching API key details:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update a specific API key
export const updateApiKey = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { agentId } = req.params;
    const { keyValue, baseUrl, modelName } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!keyValue || typeof keyValue !== 'string' || keyValue.trim() === '' ||
        !baseUrl || typeof baseUrl !== 'string' || baseUrl.trim() === '' ||
        !modelName || typeof modelName !== 'string' || modelName.trim() === '') {
      return res.status(400).json({ message: 'API key, base URL, and model name are required' });
    }

    const apiKey = await ApiKey.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), agentId },
      {
        $set: {
          keyValue: keyValue.trim(),
          baseUrl: baseUrl.trim(),
          modelName: modelName.trim(),
          agentName: AGENT_DEFINITIONS[agentId as keyof typeof AGENT_DEFINITIONS],
          isActive: true,
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    res.json({ 
      message: 'API key updated successfully',
      apiKey: {
        agentId: apiKey.agentId,
        agentName: apiKey.agentName,
        isActive: apiKey.isActive
      }
    });
  } catch (error) {
    console.error('Error updating API key:', error);
    res.status(500).json({ message: 'Failed to update API key' });
  }
};

// Delete/clear a specific API key
export const deleteApiKey = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { agentId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const result = await ApiKey.findOneAndDelete({ 
      userId: new Types.ObjectId(userId), 
      agentId 
    });

    if (!result) {
      return res.status(404).json({ message: 'API key not found' });
    }

    res.json({ message: 'API key deleted successfully' });
  } catch (error) {
    console.error('Error deleting API key:', error);
    res.status(500).json({ message: 'Failed to delete API key' });
  }
};

// Toggle API key active status
export const toggleApiKeyStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { agentId } = req.params;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const apiKey = await ApiKey.findOne({ 
      userId: new Types.ObjectId(userId), 
      agentId 
    });

    if (!apiKey) {
      return res.status(404).json({ message: 'API key not found' });
    }

    apiKey.isActive = !apiKey.isActive;
    apiKey.updatedAt = new Date();
    await apiKey.save();

    res.json({ 
      message: `API key ${apiKey.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: apiKey.isActive
    });
  } catch (error) {
    console.error('Error toggling API key status:', error);
    res.status(500).json({ message: 'Failed to update API key status' });
  }
};

// Get all available agents with their current key status
export const getAgentsStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userApiKeys = await ApiKey.find({ userId: new Types.ObjectId(userId) });
    const userKeysMap = new Map(userApiKeys.map(key => [key.agentId, key]));

    const agentsStatus = Object.entries(AGENT_DEFINITIONS).map(([agentId, agentName]) => {
      const userKey = userKeysMap.get(agentId);
      return {
        agentId,
        agentName,
        hasKey: !!userKey && userKey.isActive,
        isActive: userKey ? userKey.isActive : false,
        createdAt: userKey?.createdAt || null
      };
    });

    res.json({ agents: agentsStatus });
  } catch (error) {
    console.error('Error getting agents status:', error);
    res.status(500).json({ message: 'Failed to get agents status' });
  }
};