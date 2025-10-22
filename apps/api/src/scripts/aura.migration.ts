import mongoose from 'mongoose';
import User, { IUser } from '../model/user.model';
import CommunityPost from '../model/communityPost.model';
import { AURA_POINTS } from '../util/auraupdate.util';
import { MONGODB_URL } from '../config';

/**
 * Calculate aura for a single user based on their posts
 */
async function calculateUserAura(userId: mongoose.Types.ObjectId | string): Promise<number> {
  const posts = await CommunityPost.find({ authorId: userId });
  
  let totalAura = 0;
  
  for (const post of posts) {
    totalAura += post.analytics.views * AURA_POINTS.VIEW;
    totalAura += post.likesCount * AURA_POINTS.LIKE;
    totalAura += post.commentsCount * AURA_POINTS.COMMENT;
  }
  
  return totalAura;
}

/**
 * Main migration function
 */
async function migrateAura() {
  try {
    console.log('Starting Aura Migration...\n');
    await mongoose.connect(MONGODB_URL);

    // await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB\n');

    // Get all users with proper typing
    const users = await User.find({}).lean<IUser[]>();
    console.log(`Found ${users.length} users to process\n`);

    let processedCount = 0;
    let errorCount = 0;
    const startTime = Date.now();

    // Process each user
    for (const user of users) {
      try {
        // Type assertion to ensure _id is treated correctly
        const aura = await calculateUserAura(user._id as mongoose.Types.ObjectId);
        
        await User.findByIdAndUpdate(user._id, { aura });
        
        processedCount++;
        console.log(`✓ ${user.username}: ${aura} aura points (${processedCount}/${users.length})`);
      } catch (error) {
        errorCount++;
        console.error(`Error processing ${user.username}:`, error);
      }
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(50));
    console.log('Migration Summary:');
    console.log('='.repeat(50));
    console.log(`Successfully processed: ${processedCount} users`);
    console.log(`Errors: ${errorCount} users`);
    console.log(`Duration: ${duration} seconds`);
    console.log('='.repeat(50) + '\n');

    // Show top 5 users
    const topUsers = await User.find({ isActive: true })
      .sort({ aura: -1 })
      .limit(5)
      .select('username aura')
      .lean();

    console.log('🏆 Top 5 Users by Aura:');
    topUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username}: ${user.aura} aura`);
    });

    console.log('\n✨ Migration completed successfully!\n');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('\n Migration failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run migration
migrateAura();