import { Schema, Document, Types, Model, model } from "mongoose";

// Notification types enum
export enum NotificationType {
  FOLLOW = 'follow',
  POST_LIKE = 'post_like',
  POST_COMMENT = 'post_comment',
  COMMENT_LIKE = 'comment_like',
  COMMENT_REPLY = 'comment_reply',
  NEW_POST_FROM_FOLLOWING = 'new_post_from_following',
  MENTION = 'mention',
  POST_FEATURED = 'post_featured',
  MILESTONE = 'milestone',
  PROFILE_UPDATE = 'profile_update', // NEW: For profile photo updates
  SYSTEM = 'system' // NEW: For generic system notifications
}

// Interface for notification metadata (flexible structure for different notification types)
export interface INotificationMetadata {
  postId?: Types.ObjectId;
  postTitle?: string;
  commentId?: Types.ObjectId;
  commentContent?: string;
  milestoneType?: string;
  milestoneValue?: number;
  [key: string]: any;
}

// Main Notification interface
export interface INotification extends Document {
  recipientId: Types.ObjectId;
  senderId: Types.ObjectId;
  type: NotificationType;
  message: string;
  metadata: INotificationMetadata;
  isRead: boolean;
  isActionable: boolean;
  actionUrl?: string;
  createdAt: Date;
  readAt?: Date;
  expiresAt?: Date;
}

// Methods interface
export interface INotificationMethods {
  markAsRead(): Promise<void>;
  isExpired(): boolean;
}

// Static methods interface
export interface INotificationModel extends Model<INotification, {}, INotificationMethods> {
  markAllAsRead(userId: Types.ObjectId): Promise<number>;
  deleteOldNotifications(daysOld: number): Promise<number>;
  getUnreadCount(userId: Types.ObjectId): Promise<number>;
}

const NotificationSchema = new Schema<INotification, INotificationModel, INotificationMethods>({
  recipientId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  senderId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: Object.values(NotificationType),
    required: true,
    index: true
  },
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  isActionable: {
    type: Boolean,
    default: true
  },
  actionUrl: {
    type: String,
    maxlength: 500
  },
  readAt: {
    type: Date
  },
  expiresAt: {
    type: Date,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
NotificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, type: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, senderId: 1, type: 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Instance method to mark notification as read
NotificationSchema.methods.markAsRead = async function() {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    await this.save();
  }
};

// Instance method to check if notification is expired
NotificationSchema.methods.isExpired = function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};

// Static method to mark all notifications as read for a user
NotificationSchema.statics.markAllAsRead = async function(userId: Types.ObjectId) {
  const result = await this.updateMany(
    { recipientId: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return result.modifiedCount;
};

// Static method to delete old notifications
NotificationSchema.statics.deleteOldNotifications = async function(daysOld: number = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const result = await this.deleteMany({
    createdAt: { $lt: cutoffDate },
    isRead: true
  });
  return result.deletedCount;
};

// Static method to get unread count
NotificationSchema.statics.getUnreadCount = async function(userId: Types.ObjectId) {
  return await this.countDocuments({
    recipientId: userId,
    isRead: false
  });
};

const Notification = model<INotification, INotificationModel>(
  'Notification',
  NotificationSchema
);

export default Notification;