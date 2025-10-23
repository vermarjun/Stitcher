import mongoose from 'mongoose';
import User, { IUser } from '../model/user.model';
import { recalculateUserAuraAndStats } from '../util/auraupdate.util';
import { MONGODB_URL } from '../config';

async function migrateUserStats() {
  try {
    // Connect to MongoDB
    console.log('Starting Aura Migration...\n');
    await mongoose.connect(MONGODB_URL);

    // Get all users
    const users = await User.find({}).lean<IUser[]>();
    console.log(`Found ${users.length} users to migrate`);

    let successCount = 0;
    let errorCount = 0;

    // Process each user
    for (const user of users) {
      try {
        console.log(`Processing user: ${user.username} (${user._id})`);
        
        // Recalculate and populate stats
        await recalculateUserAuraAndStats(user._id as mongoose.Types.ObjectId);
        
        successCount++;
        console.log(`✓ Migrated ${user.username} - ${successCount}/${users.length}`);
      } catch (error) {
        errorCount++;
        console.error(`✗ Error migrating ${user.username}:`, error);
      }
    }

    console.log('\n=== Migration Complete ===');
    console.log(`Successfully migrated: ${successCount} users`);
    console.log(`Failed: ${errorCount} users`);
    console.log(`Total: ${users.length} users`);

    // Verify a sample user
    const sampleUser = await User.findOne({}).select('username aura stats');
    console.log('\n=== Sample User After Migration ===');
    console.log(JSON.stringify(sampleUser, null, 2));

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  }
}

// Run the migration
migrateUserStats();