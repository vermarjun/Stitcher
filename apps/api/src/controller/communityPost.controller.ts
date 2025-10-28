import { Request, Response } from 'express';
import { Types } from 'mongoose';
import CommunityPost, { ICommentMedia } from '../model/communityPost.model';
import Asset from '../model/asset.model';
import User from '../model/user.model';
import Backpack from '../model/backpack.model';
import {
    incrementUserPostCount,
    decrementUserPostStats,
    decrementUserCommentCount
} from '../util/auraupdate.util';
import cloudinary from '../util/cloudinary.util';
import mongoose from 'mongoose';

/**
 * Create a new community post
 * POST /api/community/posts
 * UPDATED: Now increments user's cached post count
 */
export async function createPost(req: Request, res: Response): Promise<void> {
    try {
        const { assetId, title, description, tags } = req.body;
        const authorId = req.userId;

        if (!authorId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Validate asset exists and belongs to user
        const asset = await Asset.findById(assetId);
        if (!asset) {
            res.status(404).json({ error: 'Asset not found' });
            return;
        }

        // Create post
        const post = new CommunityPost({
            assetId,
            authorId,
            title,
            description,
            tags: tags || [],
            likes: [],
            comments: [],
            analytics: {
                views: 0,
                uniqueViews: 0,
                saves: 0
            }
        });

        await post.save();

        // UPDATED: Increment user's cached post count
        await incrementUserPostCount(authorId);

        // Add post reference to user's communityPosts
        await User.findByIdAndUpdate(
            authorId,
            { $push: { communityPosts: post._id } }
        );

        res.status(201).json({
            success: true,
            data: post
        });
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ error: 'Failed to create post' });
    }
}

/**
 * Update a post (title, description, tags only)
 * PATCH /api/community/posts/:postId
 */
export async function updatePost(req: Request, res: Response): Promise<void> {
    try {
        const { postId } = req.params;
        const { title, description, tags } = req.body;
        const userId = req.userId;

        const post = await CommunityPost.findById(postId);
        if (!post) {
            res.status(404).json({ error: 'Post not found' });
            return;
        }

        // Check authorization
        if (post.authorId.toString() !== userId?.toString()) {
            res.status(403).json({ error: 'Not authorized to edit this post' });
            return;
        }

        // Update fields
        if (title) post.title = title;
        if (description !== undefined) post.description = description;
        if (tags) post.tags = tags;

        await post.save();

        res.json({
            success: true,
            data: post
        });
    } catch (error) {
        console.error('Error updating post:', error);
        res.status(500).json({ error: 'Failed to update post' });
    }
}

/**
 * Delete a post
 * DELETE /api/community/posts/:postId
 * UPDATED: Now decrements all cached stats based on post engagement
 */
export async function deletePost(req: Request, res: Response): Promise<void> {
    try {
        const { postId } = req.params;
        const userId = req.userId;

        const post = await CommunityPost.findById(postId);
        if (!post) {
            res.status(404).json({ error: 'Post not found' });
            return;
        }

        // Check authorization
        if (post.authorId.toString() !== userId?.toString()) {
            res.status(403).json({ error: 'Not authorized to delete this post' });
            return;
        }

        // UPDATED: Decrement user's cached stats based on post's engagement
        await decrementUserPostStats(post.authorId, {
            likesCount: post.likesCount,
            commentsCount: post.commentsCount,
            analytics: { views: post.analytics.views }
        });

        await CommunityPost.findByIdAndDelete(postId);

        // Remove post reference from user's communityPosts and all users' likedPosts
        await User.updateMany(
            {},
            {
                $pull: {
                    communityPosts: postId,
                    likedPosts: postId
                }
            }
        );

        res.json({
            success: true,
            message: 'Post deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ error: 'Failed to delete post' });
    }
}

// ============= POST RETRIEVAL =============
/**
 * Get a single post by ID with populated data
 * GET /api/community/posts/:postId
 */
export async function getPostById(req: Request, res: Response): Promise<void> {
    try {
        const { postId } = req.params;
        const userId = req.userId;
        const { isAddedToBackpackAttach } = req.query;

        // Build aggregation pipeline for consistent data structure
        const aggregationPipeline: any[] = [
            { $match: { _id: new Types.ObjectId(postId) } }
        ];

        // Check if asset is in backpack
        let backpackId = "";
        if (isAddedToBackpackAttach && userId) {
            const backpack = await Backpack.findOne({ userId });
            if (backpack != null) {
                backpackId = backpack._id as string;
            }
        }

        if (isAddedToBackpackAttach && Types.ObjectId.isValid(backpackId as string)) {
            aggregationPipeline.push(
                {
                    $lookup: {
                        from: 'backpacks',
                        let: { assetId: '$assetId' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq: ['$_id', new Types.ObjectId(backpackId as string)]
                                    }
                                }
                            },
                            {
                                $project: {
                                    items: {
                                        $filter: {
                                            input: '$items',
                                            as: 'item',
                                            cond: {
                                                $and: [
                                                    { $eq: ['$$item.itemType', 'Asset'] },
                                                    { $eq: ['$$item.itemId', '$$assetId'] }
                                                ]
                                            }
                                        }
                                    }
                                }
                            }
                        ],
                        as: 'backpackItems'
                    }
                },
                {
                    $addFields: {
                        isAddedToBackpack: {
                            $gt: [
                                {
                                    $size: {
                                        $ifNull: [
                                            { $arrayElemAt: ['$backpackItems.items', 0] },
                                            []
                                        ]
                                    }
                                },
                                0
                            ]
                        }
                    }
                }
            );
        } else {
            aggregationPipeline.push({
                $addFields: {
                    isAddedToBackpack: false
                }
            });
        }

        // Add isLiked field for post
        if (userId && Types.ObjectId.isValid(userId)) {
            aggregationPipeline.push({
                $addFields: {
                    isLiked: {
                        $in: [new Types.ObjectId(userId), '$likes.userId']
                    }
                }
            });
        } else {
            aggregationPipeline.push({
                $addFields: {
                    isLiked: false
                }
            });
        }

        // Add isLiked field for each comment
        if (userId && Types.ObjectId.isValid(userId)) {
            aggregationPipeline.push({
                $addFields: {
                    comments: {
                        $map: {
                            input: '$comments',
                            as: 'comment',
                            in: {
                                $mergeObjects: [
                                    '$$comment',
                                    {
                                        isLiked: {
                                            $in: [new Types.ObjectId(userId), '$$comment.likes']
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            });
        } else {
            aggregationPipeline.push({
                $addFields: {
                    comments: {
                        $map: {
                            input: '$comments',
                            as: 'comment',
                            in: {
                                $mergeObjects: [
                                    '$$comment',
                                    {
                                        isLiked: false
                                    }
                                ]
                            }
                        }
                    }
                }
            });
        }

        // Remove the backpackItems array as we only need the computed field
        aggregationPipeline.push({
            $project: {
                backpackItems: 0
            }
        });

        // Add population of referenced fields
        aggregationPipeline.push(
            {
                $lookup: {
                    from: 'users',
                    localField: 'authorId',
                    foreignField: '_id',
                    as: 'authorId',
                    pipeline: [
                        {
                            $project: {
                                username: 1,
                                profilePhoto: 1,
                                bio: 1
                            }
                        }
                    ]
                }
            },
            {
                $unwind: {
                    path: '$authorId',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'assets',
                    localField: 'assetId',
                    foreignField: '_id',
                    as: 'assetId'
                }
            },
            {
                $unwind: {
                    path: '$assetId',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'comments.userId',
                    foreignField: '_id',
                    as: 'commentUsers'
                }
            },
            {
                $addFields: {
                    comments: {
                        $map: {
                            input: '$comments',
                            as: 'comment',
                            in: {
                                $mergeObjects: [
                                    '$$comment',
                                    {
                                        userId: {
                                            $arrayElemAt: [
                                                {
                                                    $filter: {
                                                        input: '$commentUsers',
                                                        as: 'user',
                                                        cond: {
                                                            $eq: ['$$user._id', '$$comment.userId']
                                                        }
                                                    }
                                                },
                                                0
                                            ]
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    comments: {
                        $map: {
                            input: '$comments',
                            as: 'comment',
                            in: {
                                $mergeObjects: [
                                    '$$comment',
                                    {
                                        userId: {
                                            _id: '$$comment.userId._id',
                                            username: '$$comment.userId.username',
                                            profilePhoto: '$$comment.userId.profilePhoto'
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    comments: {
                        $reverseArray: '$comments'
                    }
                }
            },
            {
                $project: {
                    commentUsers: 0
                }
            }
        );

        // Execute aggregation
        const posts = await CommunityPost.aggregate(aggregationPipeline);

        if (!posts || posts.length === 0) {
            res.status(404).json({ error: 'Post not found' });
            return;
        }

        const post = posts[0];

        // Track view (need to get the actual document for the method call)
        const postDoc = await CommunityPost.findById(postId);
        if (postDoc) {
            const hasViewed = req.cookies?.[`viewed_${postId}`];
            await postDoc.incrementView(!hasViewed);
            await postDoc.save();

            // Set cookie to track unique view (expires in 24 hours)
            res.cookie(`viewed_${postId}`, 'true', {
                maxAge: 24 * 60 * 60 * 1000,
                httpOnly: true
            });
        }

        res.json({
            success: true,
            data: post
        });
    } catch (error) {
        console.error('Error fetching post:', error);
        res.status(500).json({ error: 'Failed to fetch post' });
    }
}
/**
 * Get all posts with pagination, filtering, and sorting
 * GET /api/community/posts
 */
export async function getPosts(req: Request, res: Response): Promise<void> {
    try {
        const userId = req.userId;
        const {
            page = 1,
            limit = 20,
            sortBy = 'trending',
            tags,
            search,
            isAddedToBackpackAttach
        } = req.query;
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;
        const query: any = {};
        if (tags) {
            const tagArray = (tags as string).split(',');
            query.tags = { $in: tagArray };
        }
        if (search) {
            query.$text = { $search: search as string };
        }
        let sort: any = {};
        switch (sortBy) {
            case 'popular':
                sort = { 'analytics.views': -1, publishedAt: -1 };
                break;
            case 'trending':
                sort = { likesCount: -1, 'analytics.views': -1, publishedAt: -1 };
                break;
            case 'recent':
            default:
                sort = { publishedAt: -1 };
                break;
        }
        // Build aggregation pipeline
        const aggregationPipeline: any[] = [
            { $match: query }
        ];

        // Check if assets are in backpack
        let backpackId = "";
        if (isAddedToBackpackAttach && userId) {
            const backpack = await Backpack.findOne({ userId });
            if (backpack != null) {
                backpackId = backpack._id as string;
            }
        }

        if (isAddedToBackpackAttach && Types.ObjectId.isValid(backpackId as string)) {
            aggregationPipeline.push(
                {
                    $lookup: {
                        from: 'backpacks',
                        let: { assetId: '$assetId' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq: ['$_id', new Types.ObjectId(backpackId as string)]
                                    }
                                }
                            },
                            {
                                $project: {
                                    items: {
                                        $filter: {
                                            input: '$items',
                                            as: 'item',
                                            cond: {
                                                $and: [
                                                    { $eq: ['$$item.itemType', 'Asset'] },
                                                    { $eq: ['$$item.itemId', '$$assetId'] }
                                                ]
                                            }
                                        }
                                    }
                                }
                            }
                        ],
                        as: 'backpackItems'
                    }
                },
                {
                    $addFields: {
                        isAddedToBackpack: {
                            $gt: [
                                {
                                    $size: {
                                        $ifNull: [
                                            { $arrayElemAt: ['$backpackItems.items', 0] },
                                            []
                                        ]
                                    }
                                },
                                0
                            ]
                        }
                    }
                }
            );
        } else {
            aggregationPipeline.push({
                $addFields: {
                    isAddedToBackpack: false
                }
            });
        }

        // Add isLiked field for posts
        if (userId && Types.ObjectId.isValid(userId)) {
            aggregationPipeline.push({
                $addFields: {
                    isLiked: {
                        $in: [new Types.ObjectId(userId), '$likes.userId']
                    }
                }
            });
        } else {
            aggregationPipeline.push({
                $addFields: {
                    isLiked: false
                }
            });
        }

        // Add isLiked field for each comment
        if (userId && Types.ObjectId.isValid(userId)) {
            aggregationPipeline.push({
                $addFields: {
                    comments: {
                        $map: {
                            input: '$comments',
                            as: 'comment',
                            in: {
                                $mergeObjects: [
                                    '$$comment',
                                    {
                                        isLiked: {
                                            $in: [new Types.ObjectId(userId), '$$comment.likes']
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            });
        } else {
            aggregationPipeline.push({
                $addFields: {
                    comments: {
                        $map: {
                            input: '$comments',
                            as: 'comment',
                            in: {
                                $mergeObjects: [
                                    '$$comment',
                                    {
                                        isLiked: false
                                    }
                                ]
                            }
                        }
                    }
                }
            });
        }

        // Add population for comment user details
        aggregationPipeline.push({
            $lookup: {
                from: 'users',
                localField: 'comments.userId',
                foreignField: '_id',
                as: 'commentUsers',
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            profilePhoto: 1,
                            plan: 1,
                            bio: 1
                        }
                    }
                ]
            }
        });

        // Map the populated user data to each comment
        aggregationPipeline.push({
            $addFields: {
                comments: {
                    $map: {
                        input: '$comments',
                        as: 'comment',
                        in: {
                            $mergeObjects: [
                                '$$comment',
                                {
                                    userId: {
                                        $arrayElemAt: [
                                            {
                                                $filter: {
                                                    input: '$commentUsers',
                                                    as: 'user',
                                                    cond: { $eq: ['$$user._id', '$$comment.userId'] }
                                                }
                                            },
                                            0
                                        ]
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        });

        // Remove the temporary commentUsers array
        aggregationPipeline.push({
            $project: {
                commentUsers: 0
            }
        });

        // Remove the backpackItems array as we only need the computed field
        aggregationPipeline.push({
            $project: {
                backpackItems: 0
            }
        });

        // Add sorting and pagination
        aggregationPipeline.push(
            { $sort: sort },
            { $skip: skip },
            { $limit: limitNum }
        );

        // Add population of referenced fields
        aggregationPipeline.push(
            {
                $lookup: {
                    from: 'users',
                    localField: 'authorId',
                    foreignField: '_id',
                    as: 'authorId',
                    pipeline: [
                        {
                            $project: {
                                username: 1,
                                profilePhoto: 1,
                                followers: 1,
                                plan: 1
                            }
                        }
                    ]
                }
            },
            {
                $unwind: {
                    path: '$authorId',
                    preserveNullAndEmptyArrays: true
                }
            }
        );

        // Add isFollowing field - check if current user is in author's followers array
        if (userId && Types.ObjectId.isValid(userId)) {
            aggregationPipeline.push({
                $addFields: {
                    isFollowing: {
                        $in: [
                            new Types.ObjectId(userId),
                            { $ifNull: ['$authorId.followers', []] }
                        ]
                    },
                    // Clean up authorId by removing followers array from response
                    authorId: {
                        _id: '$authorId._id',
                        username: '$authorId.username',
                        profilePhoto: '$authorId.profilePhoto',
                        plan: '$authorId.plan',
                    }
                }
            });
        } else {
            aggregationPipeline.push({
                $addFields: {
                    isFollowing: false,
                    // Clean up authorId by removing followers array from response
                    authorId: {
                        _id: '$authorId._id',
                        username: '$authorId.username',
                        profilePhoto: '$authorId.profilePhoto',
                        plan: '$authorId.plan',
                    }
                }
            });
        }

        // Continue with asset lookup
        aggregationPipeline.push(
            {
                $lookup: {
                    from: 'assets',
                    localField: 'assetId',
                    foreignField: '_id',
                    as: 'assetId',
                    pipeline: [
                        {
                            $project: {
                                url: 1,
                                thumbnail: 1,
                                duration: 1,
                                type: 1
                            }
                        }
                    ]
                }
            },
            {
                $unwind: {
                    path: '$assetId',
                    preserveNullAndEmptyArrays: true
                }
            }
        );

        // Execute aggregation and count query
        const [posts, total] = await Promise.all([
            CommunityPost.aggregate(aggregationPipeline),
            CommunityPost.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: posts,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
}

/**
 * Get posts by a specific user
 * GET /api/community/users/:userId/posts
 */
export async function getUserPosts(req: Request, res: Response): Promise<void> {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const [posts, total] = await Promise.all([
            CommunityPost.find({ authorId: userId })
                .sort({ publishedAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .populate('assetId', 'url thumbnail duration type')
                .populate('authorId', 'username bio profilePhoto plan')
                .lean(),
            CommunityPost.countDocuments({ authorId: userId })
        ]);

        res.json({
            success: true,
            data: posts,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error('Error fetching user posts:', error);
        res.status(500).json({ error: 'Failed to fetch user posts' });
    }
}

/**
 * Get posts a user has liked
 * GET /api/community/users/:userId/liked
 */
export async function getUserLikedPosts(req: Request, res: Response): Promise<void> {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const [posts, total] = await Promise.all([
            CommunityPost.find({ 'likes.userId': userId })
                .sort({ 'likes.createdAt': -1 })
                .skip(skip)
                .limit(limitNum)
                .populate('authorId', 'username profilePhoto')
                .populate('assetId', 'url thumbnail duration type')
                .lean(),
            CommunityPost.countDocuments({ 'likes.userId': userId })
        ]);

        res.json({
            success: true,
            data: posts,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error('Error fetching liked posts:', error);
        res.status(500).json({ error: 'Failed to fetch liked posts' });
    }
}

export const getUserComments = async (req: Request, res: Response) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.params.userId);

    const userComments = await CommunityPost.aggregate([
      { $unwind: "$comments" }, // Flatten comments array
      { $match: { "comments.userId": userId } }, // Filter comments made by this user
      {
        $project: {
          _id: 0,
          postId: "$_id",
          postTitle: "$title",
          commentId: "$comments._id",
          content: "$comments.content",
          media: "$comments.media",
          likesCount: { $size: "$comments.likes" },
          createdAt: "$comments.createdAt",
          updatedAt: "$comments.updatedAt",
          isEdited: "$comments.isEdited",
        },
      },
      { $sort: { createdAt: -1 } }, // Recent first
    ]);

    return res.status(200).json({
      success: true,
      count: userComments.length,
      comments: userComments,
    });
  } catch (error) {
    console.error("Error fetching user comments:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// ============= LIKE MANAGEMENT =============
/**
 * Toggle like on a post
 * POST /api/community/posts/:postId/like
 * NO CHANGES NEEDED - Like tracking happens in post.addLike()/removeLike() methods
 */
export async function toggleLike(req: Request, res: Response): Promise<void> {
    try {
        const { postId } = req.params;
        const userId = req.userId;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const userIdObjectId = new Types.ObjectId(userId);
        const post = await CommunityPost.findById(postId);

        if (!post) {
            res.status(404).json({ error: 'Post not found' });
            return;
        }

        const hasLiked = post.likes.some(
            like => like.userId.toString() === userId.toString()
        );

        if (hasLiked) {
            // Unlike (stats updated in post.removeLike())
            await post.removeLike(userIdObjectId);
            await User.findByIdAndUpdate(
                userId,
                { $pull: { likedPosts: postId } }
            );
        } else {
            // Like (stats updated in post.addLike())
            await post.addLike(userIdObjectId);
            await User.findByIdAndUpdate(
                userId,
                { $addToSet: { likedPosts: postId } }
            );
        }

        await post.save();

        res.json({
            success: true,
            data: {
                liked: !hasLiked,
                likesCount: post.likesCount
            }
        });
    } catch (error) {
        console.error('Error toggling like:', error);
        res.status(500).json({ error: 'Failed to toggle like' });
    }
}

/**
 * Get users who liked a post
 * GET /api/community/posts/:postId/likes
 * NO CHANGES NEEDED
 */
export async function getPostLikes(req: Request, res: Response): Promise<void> {
    try {
        const { postId } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);

        const post = await CommunityPost.findById(postId)
            .populate({
                path: 'likes.userId',
                select: 'username profilePhoto',
                options: {
                    skip: (pageNum - 1) * limitNum,
                    limit: limitNum
                }
            });

        if (!post) {
            res.status(404).json({ error: 'Post not found' });
            return;
        }

        res.json({
            success: true,
            data: post.likes,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: post.likesCount
            }
        });
    } catch (error) {
        console.error('Error fetching post likes:', error);
        res.status(500).json({ error: 'Failed to fetch likes' });
    }
}
// ============= COMMENT MANAGEMENT =============

/**
 * Add a comment to a post (with optional media)
 * POST /api/community/posts/:postId/comments
 */
export async function addComment(req: any, res: Response): Promise<void> {
    try {
        const { postId } = req.params;
        const { content, parentCommentId } = req.body;
        const userId = req.userId;

        if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        if ((!content || content.trim().length === 0) && !req.file) {
            res.status(400).json({ error: "Comment must have text or media" });
            return;
        }

        const post = await CommunityPost.findById(postId);
        if (!post) {
            res.status(404).json({ error: "Post not found" });
            return;
        }

        // Optional parent comment validation
        if (parentCommentId) {
            const parentExists = post.comments.some(
                (c) => c._id.toString() === parentCommentId
            );
            if (!parentExists) {
                res.status(404).json({ error: "Parent comment not found" });
                return;
            }
        }

        // ---- Handle Cloudinary uploads (if any files) ----
        const uploadedMedia: ICommentMedia[] = [];

        // Upload to Cloudinary and WAIT for it to complete
        if (req.file && req.file.buffer) {
            await new Promise<void>((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        folder: "comments_media",
                        resource_type: "auto"
                    },
                    (error, result) => {
                        if (error || !result) {
                            reject(error || new Error('Upload failed'));
                            return;
                        }

                        uploadedMedia.push({
                            mediaType: "image",
                            thumbnailUrl: result.secure_url,
                            order: 0,
                        });

                        resolve();
                    }
                );

                uploadStream.end(req.file.buffer);
            });
        }

        // ---- Add comment to post ----
        const userIdObjectId = new Types.ObjectId(userId);
        const commentId = await post.addComment(
            userIdObjectId,
            content?.trim() || "",
            uploadedMedia.length ? uploadedMedia : undefined,
            parentCommentId ? new Types.ObjectId(parentCommentId) : undefined
        );

        await post.save();

        const updatedPost = await CommunityPost.findById(postId).populate(
            "comments.userId",
            "username profilePhoto"
        );

        const newComment = updatedPost?.comments.find(
            (c) => c._id.toString() === commentId.toString()
        );

        res.status(201).json({
            success: true,
            data: newComment,
        });
    } catch (error) {
        console.error("Error adding comment:", error);
        res.status(500).json({ error: "Failed to add comment" });
    }
}

/**
 * Update a comment
 * PATCH /api/community/posts/:postId/comments/:commentId
 * NO CHANGES NEEDED - Editing doesn't change stats
 */
export async function updateComment(req: Request, res: Response): Promise<void> {
    try {
        const { postId, commentId } = req.params;
        const { content } = req.body;
        const userId = req.userId;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const post = await CommunityPost.findById(postId);
        if (!post) {
            res.status(404).json({ error: 'Post not found' });
            return;
        }

        const comment = post.comments.find(
            c => c._id.toString() === commentId
        );

        if (!comment) {
            res.status(404).json({ error: 'Comment not found' });
            return;
        }

        if (comment.userId.toString() !== userId.toString()) {
            res.status(403).json({ error: 'Not authorized to edit this comment' });
            return;
        }

        comment.content = content.trim();
        comment.isEdited = true;
        comment.updatedAt = new Date();

        await post.save();

        res.json({
            success: true,
            data: comment
        });
    } catch (error) {
        console.error('Error updating comment:', error);
        res.status(500).json({ error: 'Failed to update comment' });
    }
}

/**
 * Delete a comment
 * DELETE /api/community/posts/:postId/comments/:commentId
 * UPDATED: Now decrements cached comment count for post author
 */
export async function deleteComment(req: Request, res: Response): Promise<void> {
    try {
        const { postId, commentId } = req.params;
        const userId = req.userId;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const post = await CommunityPost.findById(postId);
        if (!post) {
            res.status(404).json({ error: 'Post not found' });
            return;
        }

        const comment = post.comments.find(
            c => c._id.toString() === commentId
        );

        if (!comment) {
            res.status(404).json({ error: 'Comment not found' });
            return;
        }

        const isAuthor = comment.userId.toString() === userId.toString();
        const isPostOwner = post.authorId.toString() === userId.toString();

        if (!isAuthor && !isPostOwner) {
            res.status(403).json({ error: 'Not authorized to delete this comment' });
            return;
        }

        // Count how many comments will be deleted (including replies)
        const commentsToDelete = post.comments.filter(
            c => c._id.toString() === commentId ||
                c.parentCommentId?.toString() === commentId
        );
        const deleteCount = commentsToDelete.length;

        // Remove comment and all its replies
        post.comments = post.comments.filter(
            c => c._id.toString() !== commentId &&
                c.parentCommentId?.toString() !== commentId
        );
        post.commentsCount = post.comments.length;

        await post.save();

        // UPDATED: Decrement cached comment count for each deleted comment
        for (let i = 0; i < deleteCount; i++) {
            await decrementUserCommentCount(post.authorId);
        }

        res.json({
            success: true,
            message: 'Comment deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
}

/**
 * Toggle like on a comment
 * POST /api/community/posts/:postId/comments/:commentId/like
 * NO CHANGES NEEDED - Comment likes don't affect user stats (only post author stats)
 */
export async function toggleCommentLike(req: Request, res: Response): Promise<void> {
    try {
        const { postId, commentId } = req.params;
        const userId = req.userId;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const userIdObjectId = new Types.ObjectId(userId);
        const post = await CommunityPost.findById(postId);

        if (!post) {
            res.status(404).json({ error: 'Post not found' });
            return;
        }

        const comment = post.comments.find(
            c => c._id.toString() === commentId
        );

        if (!comment) {
            res.status(404).json({ error: 'Comment not found' });
            return;
        }

        const hasLiked = comment.likes.some(
            id => id.toString() === userId.toString()
        );

        if (hasLiked) {
            comment.likes = comment.likes.filter(
                id => id.toString() !== userId.toString()
            );
        } else {
            comment.likes.push(userIdObjectId);
        }

        await post.save();

        res.json({
            success: true,
            data: {
                liked: !hasLiked,
                likesCount: comment.likes.length
            }
        });
    } catch (error) {
        console.error('Error toggling comment like:', error);
        res.status(500).json({ error: 'Failed to toggle comment like' });
    }
}

/**
 * Get comments for a post with pagination
 * GET /api/community/posts/:postId/comments
 */
export async function getComments(req: Request, res: Response): Promise<void> {
    try {
        const { postId } = req.params;
        const userId = req.userId;
        const { page = 1, limit = 20, parentCommentId } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);

        // Build aggregation pipeline for consistent data structure
        const aggregationPipeline: any[] = [
            { $match: { _id: new Types.ObjectId(postId) } }
        ];

        // Add isLiked field for each comment
        if (userId && Types.ObjectId.isValid(userId)) {
            aggregationPipeline.push({
                $addFields: {
                    comments: {
                        $map: {
                            input: '$comments',
                            as: 'comment',
                            in: {
                                $mergeObjects: [
                                    '$$comment',
                                    {
                                        isLiked: {
                                            $in: [new Types.ObjectId(userId), '$$comment.likes']
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            });
        } else {
            aggregationPipeline.push({
                $addFields: {
                    comments: {
                        $map: {
                            input: '$comments',
                            as: 'comment',
                            in: {
                                $mergeObjects: [
                                    '$$comment',
                                    {
                                        isLiked: false
                                    }
                                ]
                            }
                        }
                    }
                }
            });
        }

        // Populate comment user data
        aggregationPipeline.push(
            {
                $lookup: {
                    from: 'users',
                    localField: 'comments.userId',
                    foreignField: '_id',
                    as: 'commentUsers'
                }
            },
            {
                $addFields: {
                    comments: {
                        $map: {
                            input: '$comments',
                            as: 'comment',
                            in: {
                                $mergeObjects: [
                                    '$$comment',
                                    {
                                        userId: {
                                            $arrayElemAt: [
                                                {
                                                    $filter: {
                                                        input: '$commentUsers',
                                                        as: 'user',
                                                        cond: {
                                                            $eq: ['$$user._id', '$$comment.userId']
                                                        }
                                                    }
                                                },
                                                0
                                            ]
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    comments: {
                        $map: {
                            input: '$comments',
                            as: 'comment',
                            in: {
                                $mergeObjects: [
                                    '$$comment',
                                    {
                                        userId: {
                                            _id: '$$comment.userId._id',
                                            username: '$$comment.userId.username',
                                            profilePhoto: '$$comment.userId.profilePhoto'
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    comments: 1
                }
            }
        );

        // Execute aggregation
        const posts = await CommunityPost.aggregate(aggregationPipeline);

        if (!posts || posts.length === 0) {
            res.status(404).json({ error: 'Post not found' });
            return;
        }

        const post = posts[0];
        let comments = post.comments;

        // Filter by parentCommentId if provided
        if (parentCommentId) {
            comments = comments.filter(
                (c: any) => c.parentCommentId?.toString() === parentCommentId
            );
        } else {
            comments = comments.filter((c: any) => !c.parentCommentId);
        }

        // Sort by creation date (newest first)
        comments.sort((a: any, b: any) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return dateB - dateA;
        });

        const total = comments.length;
        const paginatedComments = comments.slice(
            (pageNum - 1) * limitNum,
            pageNum * limitNum
        );

        res.json({
            success: true,
            data: paginatedComments,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
}

// ============= SEARCH & DISCOVERY =============
// NO CHANGES NEEDED FOR ANY OF THESE

export async function searchPosts(req: Request, res: Response): Promise<void> {
    try {
        const { q, page = 1, limit = 20 } = req.query;

        if (!q) {
            res.status(400).json({ error: 'Search query is required' });
            return;
        }

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        const [posts, total] = await Promise.all([
            CommunityPost.find(
                { $text: { $search: q as string } },
                { score: { $meta: 'textScore' } }
            )
                .sort({ score: { $meta: 'textScore' } })
                .skip(skip)
                .limit(limitNum)
                .populate('authorId', 'username profilePhoto')
                .populate('assetId', 'url thumbnail duration type')
                .lean(),
            CommunityPost.countDocuments({ $text: { $search: q as string } })
        ]);

        res.json({
            success: true,
            data: posts,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error('Error searching posts:', error);
        res.status(500).json({ error: 'Failed to search posts' });
    }
}

export async function getPostsByTag(req: Request, res: Response): Promise<void> {
    try {
        const { tag } = req.params;
        const { page = 1, limit = 20, sortBy = 'recent' } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        let sort: any = {};
        switch (sortBy) {
            case 'popular':
                sort = { likesCount: -1, publishedAt: -1 };
                break;
            case 'recent':
            default:
                sort = { publishedAt: -1 };
                break;
        }

        const [posts, total] = await Promise.all([
            CommunityPost.find({ tags: tag.toLowerCase() })
                .sort(sort)
                .skip(skip)
                .limit(limitNum)
                .populate('authorId', 'username profilePhoto')
                .populate('assetId', 'url thumbnail duration type')
                .lean(),
            CommunityPost.countDocuments({ tags: tag.toLowerCase() })
        ]);

        res.json({
            success: true,
            data: posts,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error('Error fetching posts by tag:', error);
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
}

export async function getPostsByIds(req: Request, res: Response): Promise<void> {
    try {
        const { postIds } = req.body;

        if (!Array.isArray(postIds) || postIds.length === 0) {
            res.status(400).json({ error: 'postIds array is required' });
            return;
        }

        const posts = await CommunityPost.find({
            _id: { $in: postIds }
        })
            .populate('authorId', 'username profilePhoto')
            .populate('assetId', 'url thumbnail duration type')
            .lean();

        res.json({
            success: true,
            data: posts
        });
    } catch (error) {
        console.error('Error fetching posts by IDs:', error);
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
}