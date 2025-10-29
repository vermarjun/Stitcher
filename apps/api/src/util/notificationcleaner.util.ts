import cron from 'node-cron';
import { NotificationService } from './notificationservice.util';

/**
 * Scheduled job to clean up old notifications
 * Runs daily at 2:00 AM
 * 
 * Install node-cron: npm install node-cron @types/node-cron
 */
export function startNotificationCleanupJob() {
  // Run every day at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('[Notification Cleanup] Starting cleanup job...');
    
    try {
      // Delete read notifications older than 90 days
      const deletedCount = await NotificationService.cleanupOldNotifications(90);
      
      console.log(`[Notification Cleanup] Successfully deleted ${deletedCount} old notifications`);
    } catch (error) {
      console.error('[Notification Cleanup] Error during cleanup:', error);
    }
  });

  console.log('[Notification Cleanup] Cleanup job scheduled (daily at 2:00 AM)');
}

/**
 * Alternative: Manual cleanup function
 * Call this from an admin endpoint or script
 */
export async function manualNotificationCleanup(daysOld: number = 90) {
  try {
    console.log(`[Manual Cleanup] Deleting notifications older than ${daysOld} days...`);
    
    const deletedCount = await NotificationService.cleanupOldNotifications(daysOld);
    
    console.log(`[Manual Cleanup] Successfully deleted ${deletedCount} notifications`);
    
    return {
      success: true,
      deletedCount
    };
  } catch (error) {
    console.error('[Manual Cleanup] Error:', error);
    throw error;
  }
}

/**
 * Add this to your main server file (app.ts or server.ts)
 * 
 * Example:
 * 
 * import { startNotificationCleanupJob } from './jobs/notification.cleanup';
 * 
 * // After connecting to database
 * mongoose.connect(process.env.MONGODB_URI).then(() => {
 *   console.log('Connected to MongoDB');
 *   startNotificationCleanupJob();
 * });
 */