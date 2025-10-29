import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { NotificationService } from '../util/notificationservice.util';

export class NotificationController {
  
  /**
   * Get user's notifications
   * GET /api/notifications?page=1&limit=20&unreadOnly=false
   */
  static async getNotifications(req: Request, res: Response) {
    try {
      const userId = new Types.ObjectId(req.userId);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const unreadOnly = req.query.unreadOnly === 'true';

      const result = await NotificationService.getUserNotifications(
        userId,
        page,
        limit,
        unreadOnly
      );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch notifications'
      });
    }
  }

  /**
   * Get unread notification count
   * GET /api/notifications/unread-count
   */
  static async getUnreadCount(req: Request, res: Response) {
    try {
      const userId = new Types.ObjectId(req.userId);
      const count = await NotificationService.getUnreadCount(userId);

      res.status(200).json({
        success: true,
        data: { count }
      });
    } catch (error) {
      console.error('Error fetching unread count:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch unread count'
      });
    }
  }

  /**
   * Mark a notification as read
   * PATCH /api/notifications/:id/read
   */
  static async markAsRead(req: Request, res: Response) {
    try {
      const userId = new Types.ObjectId(req.userId);
      const notificationId = new Types.ObjectId(req.params.id);

      const notification = await NotificationService.markAsRead(notificationId, userId);

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.status(200).json({
        success: true,
        data: notification
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read'
      });
    }
  }

  /**
   * Mark all notifications as read
   * PATCH /api/notifications/read-all
   */
  static async markAllAsRead(req: Request, res: Response) {
    try {
      const userId = new Types.ObjectId(req.userId);
      const count = await NotificationService.markAllAsRead(userId);

      res.status(200).json({
        success: true,
        data: { markedAsReadCount: count }
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark all notifications as read'
      });
    }
  }

  /**
   * Delete a notification
   * DELETE /api/notifications/:id
   */
  static async deleteNotification(req: Request, res: Response) {
    try {
      const userId = new Types.ObjectId(req.userId);
      const notificationId = new Types.ObjectId(req.params.id);

      const deleted = await NotificationService.deleteNotification(notificationId, userId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Notification deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete notification'
      });
    }
  }
}