import cron from 'node-cron';
import { NotificationService } from './notificationservice.util';
import logger from './logger.util';

/**
 * Scheduled job to clean up old notifications
 * Runs daily at 2:00 AM
 * 
 * Install node-cron: npm install node-cron @types/node-cron
 */
export function startNotificationCleanupJob() {
  // Run every day at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    logger.info('[Notification Cleanup] Starting cleanup job...');

    try {
      // Delete read notifications older than 90 days
      const deletedCount = await NotificationService.cleanupOldNotifications(90);

      logger.info({ message: '[Notification Cleanup] Cleanup complete', deletedCount });
    } catch (error) {
      logger.error({ message: '[Notification Cleanup] Error during cleanup', error: String(error) });
    }
  });

  logger.info('[Notification Cleanup] Cleanup job scheduled (daily at 2:00 AM)');
}

/**
 * Alternative: Manual cleanup function
 * Call this from an admin endpoint or script
 */
export async function manualNotificationCleanup(daysOld: number = 90) {
  try {
    logger.info({ message: '[Manual Cleanup] Starting', daysOld });

    const deletedCount = await NotificationService.cleanupOldNotifications(daysOld);

    logger.info({ message: '[Manual Cleanup] Complete', deletedCount });

    return {
      success: true,
      deletedCount
    };
  } catch (error) {
    logger.error({ message: '[Manual Cleanup] Error', error: String(error) });
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