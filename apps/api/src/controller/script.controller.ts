import { Request, Response } from 'express';
import Project from '../model/project.model';
import { Types } from 'mongoose';

interface IProjectScriptRequest extends Request {
  userId?: string;
  body: {
    project_script?: string;
    [key: string]: any;
  };
}

interface IProjectScriptResponse extends Response {
  [key: string]: any;
}

interface IProject {
  _id: Types.ObjectId;
  name: string;
  project_script: string;
  status: 'draft' | 'in_progress' | 'compiled' | 'error';
  updatedAt: Date;
  [key: string]: any;
}

export const getProjectScript = async (req: IProjectScriptRequest, res: IProjectScriptResponse): Promise<Response> => {
  try {
    const { projectId } = req.params;

    if (!projectId || !Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID.' });
    }

    const project: IProject | null = await Project.findById(projectId).select('project_script name status');

    if (!project) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    return res.status(200).json({
      project_script: project.project_script
    });
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const updateProjectScript = async (req: IProjectScriptRequest, res: IProjectScriptResponse): Promise<Response> => {
  try {
    const { projectId } = req.params;
    const { project_script } = req.body;

    if (!projectId || !Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID.' });
    }

    if (typeof project_script !== 'string') {
      return res.status(400).json({ message: 'Project script must be a string.' });
    }

    const updatedProject: IProject | null = await Project.findByIdAndUpdate(
      projectId,
      { 
        project_script,
        ...(project_script.trim().length > 0 && { status: 'in_progress' })
      },
      { new: true, runValidators: true }
    ).select('project_script name status updatedAt');

    if (!updatedProject) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    return res.status(200).json({
      message: 'Project script updated successfully.',
      project_script: updatedProject.project_script,
      project_name: updatedProject.name,
      project_id: updatedProject._id.toString(),
      status: updatedProject.status,
      updated_at: updatedProject.updatedAt
    });
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const editProjectScript = async (req: IProjectScriptRequest, res: IProjectScriptResponse): Promise<Response> => {
  try {
    const { projectId } = req.params;
    const { project_script } = req.body;

    if (!projectId || !Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID.' });
    }

    if (typeof project_script !== 'string') {
      return res.status(400).json({ message: 'Project script must be a string.' });
    }

    const currentProject: IProject | null = await Project.findById(projectId);
    
    if (!currentProject) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    // Append the new script content to existing script
    const updatedProject: IProject | null = await Project.findByIdAndUpdate(
      projectId,
      { 
        project_script: currentProject.project_script + '\n' + project_script,
        status: 'in_progress'
      },
      { new: true, runValidators: true }
    ).select('project_script name status updatedAt');

    if (!updatedProject) {
      return res.status(404).json({ message: 'Project not found.' });
    }

    return res.status(200).json({
      message: 'Project script edited successfully.',
      project_script: updatedProject.project_script,
      project_name: updatedProject.name,
      project_id: updatedProject._id.toString(),
      status: updatedProject.status,
      updated_at: updatedProject.updatedAt,
      operation: 'append'
    });
  } catch (err: any) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};
