import { Request, Response } from 'express';
import { ApiKey, IApiKey } from '../model/userapikeys.model';

// Get all API keys for the current user
export const getApiKeys = async (req: Request, res: Response) => {
  try {
    const userId = req.userId; // Assuming you have authentication middleware
    const apiKeys = await ApiKey.find({ userId });
    res.json(apiKeys);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching API keys', error });
  }
};

// Add a new API key
export const addApiKey = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { name, key, service, weight } = req.body;

    const newApiKey = new ApiKey({
      userId,
      name,
      key,
      service,
      weight: weight || 1,
    });

    await newApiKey.save();
    res.status(201).json(newApiKey);
  } catch (error) {
    res.status(500).json({ message: 'Error adding API key', error });
  }
};

// Update an API key
export const updateApiKey = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { name, key, service, weight, isActive } = req.body;

    const updatedKey = await ApiKey.findOneAndUpdate(
      { _id: id, userId },
      { name, key, service, weight, isActive },
      { new: true }
    );

    if (!updatedKey) {
      return res.status(404).json({ message: 'API key not found' });
    }

    res.json(updatedKey);
  } catch (error) {
    res.status(500).json({ message: 'Error updating API key', error });
  }
};

// Delete an API key
export const deleteApiKey = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const deletedKey = await ApiKey.findOneAndDelete({ _id: id, userId });

    if (!deletedKey) {
      return res.status(404).json({ message: 'API key not found' });
    }

    res.json({ message: 'API key deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting API key', error });
  }
};

// Get the best API key for a given task (based on weight)
export const getBestApiKey = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { service, taskWeight } = req.query;

    // Find the API key with the highest weight that's >= taskWeight
    // If none found, use the highest weight available
    const apiKey = await ApiKey.findOne({
      userId,
      service,
      isActive: true,
    })
      .sort({ weight: -1 })
      .exec();

    if (!apiKey) {
      return res.status(404).json({ message: 'No active API key found for this service' });
    }

    // Return the key info (you might want to omit the actual key value for security)
    res.json({
      id: apiKey._id,
      name: apiKey.name,
      service: apiKey.service,
      weight: apiKey.weight,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error finding API key', error });
  }
};