import { Router } from 'express';
import { NotificationController } from '../controller/notification.controller';
import authMiddleware from '../middleware/auth.middleware'; 

const router = Router();

// All notification routes require authentication
router.use(authMiddleware);

/**
 * @route   GET /api/notifications
 * @desc    Get user's notifications with pagination
 * @access  Private
 * @query   page, limit, unreadOnly
 */
router.get('/', NotificationController.getNotifications);

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get count of unread notifications
 * @access  Private
 */
router.get('/unread-count', NotificationController.getUnreadCount);

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.patch('/read-all', NotificationController.markAllAsRead);

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark a specific notification as read
 * @access  Private
 */
router.patch('/:id/read', NotificationController.markAsRead);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  Private
 */
router.delete('/:id', NotificationController.deleteNotification);

export default router;