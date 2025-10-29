import { Types } from 'mongoose';
import Notification, { NotificationType, INotificationMetadata } from '../model/notifications.model';
import User from '../model/user.model';

export class NotificationService {
  
  /**
   * Create a notification with deduplication logic
   */
  private static async createNotification(
    recipientId: Types.ObjectId,
    senderId: Types.ObjectId,
    type: NotificationType,
    message: string,
    metadata: INotificationMetadata = {},
    actionUrl?: string,
    expiresInDays?: number
  ) {
    // Don't send notification to self
    if (recipientId.toString() === senderId.toString()) {
      return null;
    }

    // Check if similar notification already exists (within last 24 hours)
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    const existingNotification = await Notification.findOne({
      recipientId,
      senderId,
      type,
      'metadata.postId': metadata.postId,
      'metadata.commentId': metadata.commentId,
      createdAt: { $gte: yesterday }
    });

    // If duplicate exists and is unread, don't create new one
    if (existingNotification && !existingNotification.isRead) {
      return existingNotification;
    }

    // Calculate expiration date if specified
    let expiresAt: Date | undefined;
    if (expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    const notification = new Notification({
      recipientId,
      senderId,
      type,
      message,
      metadata,
      actionUrl,
      expiresAt
    });

    await notification.save();
    return notification;
  }

  /**
   * Notify when someone follows a user
   */
  static async notifyFollow(followerId: Types.ObjectId, followedUserId: Types.ObjectId) {
    const follower = await User.findById(followerId).select('username');
    if (!follower) return null;

    return await this.createNotification(
      followedUserId,
      followerId,
      NotificationType.FOLLOW,
      `${follower.username} started following you`,
      {},
      `/profile/${follower.username}`
    );
  }

  /**
   * Notify when someone likes a post
   */
  static async notifyPostLike(
    likerId: Types.ObjectId,
    postAuthorId: Types.ObjectId,
    postId: Types.ObjectId,
    postTitle: string
  ) {
    const liker = await User.findById(likerId).select('username');
    if (!liker) return null;

    return await this.createNotification(
      postAuthorId,
      likerId,
      NotificationType.POST_LIKE,
      `${liker.username} liked your post "${postTitle.substring(0, 50)}"`,
      { postId, postTitle },
      `/post/${postId}`
    );
  }

  /**
   * Notify when someone comments on a post
   */
  static async notifyPostComment(
    commenterId: Types.ObjectId,
    postAuthorId: Types.ObjectId,
    postId: Types.ObjectId,
    postTitle: string,
    commentId: Types.ObjectId,
    commentContent: string
  ) {
    const commenter = await User.findById(commenterId).select('username');
    if (!commenter) return null;

    return await this.createNotification(
      postAuthorId,
      commenterId,
      NotificationType.POST_COMMENT,
      `${commenter.username} commented on your post "${postTitle.substring(0, 50)}"`,
      { 
        postId, 
        postTitle, 
        commentId,
        commentContent: commentContent.substring(0, 100)
      },
      `/post/${postId}#comment-${commentId}`
    );
  }

  /**
   * Notify when someone likes a comment
   */
  static async notifyCommentLike(
    likerId: Types.ObjectId,
    commentAuthorId: Types.ObjectId,
    postId: Types.ObjectId,
    commentId: Types.ObjectId,
    commentContent: string
  ) {
    const liker = await User.findById(likerId).select('username');
    if (!liker) return null;

    return await this.createNotification(
      commentAuthorId,
      likerId,
      NotificationType.COMMENT_LIKE,
      `${liker.username} liked your comment`,
      { 
        postId, 
        commentId,
        commentContent: commentContent.substring(0, 100)
      },
      `/post/${postId}#comment-${commentId}`
    );
  }

  /**
   * Notify when someone replies to a comment
   */
  static async notifyCommentReply(
    replierId: Types.ObjectId,
    parentCommentAuthorId: Types.ObjectId,
    postId: Types.ObjectId,
    commentId: Types.ObjectId,
    replyContent: string
  ) {
    const replier = await User.findById(replierId).select('username');
    if (!replier) return null;

    return await this.createNotification(
      parentCommentAuthorId,
      replierId,
      NotificationType.COMMENT_REPLY,
      `${replier.username} replied to your comment`,
      { 
        postId, 
        commentId,
        commentContent: replyContent.substring(0, 100)
      },
      `/post/${postId}#comment-${commentId}`
    );
  }

  /**
   * Notify followers when someone they follow creates a new post
   */
  static async notifyNewPostFromFollowing(
    authorId: Types.ObjectId,
    postId: Types.ObjectId,
    postTitle: string
  ) {
    const author = await User.findById(authorId).select('username followers');
    if (!author || !author.followers || author.followers.length === 0) {
      return [];
    }

    const notifications = [];
    
    // Create notifications for all followers
    for (const followerId of author.followers) {
      const notification = await this.createNotification(
        followerId,
        authorId,
        NotificationType.NEW_POST_FROM_FOLLOWING,
        `${author.username} posted: "${postTitle.substring(0, 50)}"`,
        { postId, postTitle },
        `/post/${postId}`,
        7 // Expire after 7 days
      );
      if (notification) {
        notifications.push(notification);
      }
    }

    return notifications;
  }

  /**
   * Notify when a post is featured
   */
  static async notifyPostFeatured(
    postAuthorId: Types.ObjectId,
    postId: Types.ObjectId,
    postTitle: string
  ) {
    // This would typically be sent by an admin/system
    const systemUserId = new Types.ObjectId('000000000000000000000000'); // System user ID

    return await this.createNotification(
      postAuthorId,
      systemUserId,
      NotificationType.POST_FEATURED,
      `Congratulations! Your post "${postTitle.substring(0, 50)}" has been featured`,
      { postId, postTitle },
      `/post/${postId}`,
      30 // Expire after 30 days
    );
  }

  /**
   * Notify about milestones (followers, likes, etc.)
   */
  static async notifyMilestone(
    userId: Types.ObjectId,
    milestoneType: 'followers' | 'likes' | 'posts' | 'views',
    milestoneValue: number
  ) {
    const systemUserId = new Types.ObjectId('000000000000000000000000');
    
    const messages = {
      followers: `You've reached ${milestoneValue} followers! 🎉`,
      likes: `Your posts have received ${milestoneValue} likes! ❤️`,
      posts: `You've created ${milestoneValue} posts! 📝`,
      views: `Your content has been viewed ${milestoneValue} times! 👀`
    };

    return await this.createNotification(
      userId,
      systemUserId,
      NotificationType.MILESTONE,
      messages[milestoneType],
      { milestoneType, milestoneValue },
      `/profile`,
      90 // Expire after 90 days
    );
  }

  /**
   * Notify user about profile updates (like photo changes)
   */
  static async notifyProfileUpdate(
    userId: Types.ObjectId,
    updateType: 'photo' | 'bio' | 'username',
    message: string,
    metadata: INotificationMetadata = {}
  ) {
    const systemUserId = new Types.ObjectId('000000000000000000000000');

    return await this.createNotification(
      userId,
      systemUserId,
      NotificationType.PROFILE_UPDATE,
      message,
      { updateType, ...metadata },
      `/profile`,
      30 // Expire after 30 days
    );
  }

  /**
   * Send generic system notification
   */
  static async notifySystem(
    userId: Types.ObjectId,
    message: string,
    metadata: INotificationMetadata = {},
    actionUrl?: string,
    expiresInDays?: number
  ) {
    const systemUserId = new Types.ObjectId('000000000000000000000000');

    return await this.createNotification(
      userId,
      systemUserId,
      NotificationType.SYSTEM,
      message,
      metadata,
      actionUrl,
      expiresInDays
    );
  }

  /**
   * Get user's notifications with pagination
   */
  static async getUserNotifications(
    userId: Types.ObjectId,
    page: number = 1,
    limit: number = 20,
    unreadOnly: boolean = false
  ) {
    const query: any = { recipientId: userId };
    if (unreadOnly) {
      query.isRead = false;
    }

    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .populate('senderId', 'username profilePhoto')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query)
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: Types.ObjectId, userId: Types.ObjectId) {
    const notification = await Notification.findOne({
      _id: notificationId,
      recipientId: userId
    });

    if (notification) {
      await notification.markAsRead();
      return notification;
    }
    return null;
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: Types.ObjectId) {
    return await Notification.markAllAsRead(userId);
  }

  /**
   * Get unread count
   */
  static async getUnreadCount(userId: Types.ObjectId) {
    return await Notification.getUnreadCount(userId);
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(notificationId: Types.ObjectId, userId: Types.ObjectId) {
    const result = await Notification.deleteOne({
      _id: notificationId,
      recipientId: userId
    });
    return result.deletedCount > 0;
  }

  /**
   * Cleanup old read notifications (run as scheduled job)
   */
  static async cleanupOldNotifications(daysOld: number = 90) {
    return await Notification.deleteOldNotifications(daysOld);
  }
}