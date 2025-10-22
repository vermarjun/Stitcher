import { Request, Response } from 'express';
import { Types } from 'mongoose';
import CommunityPost, { ICommunityPost, IComment } from '../model/communityPost.model';
import Asset from '../model/asset.model';
import User from '../model/user.model';

/**
 * Create a new community post
 * POST /api/community/posts
 */
export async function createPost(req: Request, res: Response): Promise<void> {
    console.log("HIT")
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

        const post = await CommunityPost.findById(postId)
            .populate('authorId', 'username profilePhoto bio')
            .populate('assetId')
            .populate('comments.userId', 'username profilePhoto');

        if (!post) {
            res.status(404).json({ error: 'Post not found' });
            return;
        }

        // Track view
        const hasViewed = req.cookies?.[`viewed_${postId}`];
        await post.incrementView(!hasViewed);
        await post.save();

        // Set cookie to track unique view (expires in 24 hours)
        res.cookie(`viewed_${postId}`, 'true', {
            maxAge: 24 * 60 * 60 * 1000,
            httpOnly: true
        });

        // Check if current user has liked the post
        const hasLiked = userId
            ? post.likes.some(like => like.userId.toString() === userId.toString())
            : false;

        res.json({
            success: true,
            data: {
                ...post.toObject(),
                hasLiked
            }
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
        const {
            page = 1,
            limit = 20,
            sortBy = 'recent', // recent, popular, trending
            tags,
            search
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        // Build query
        const query: any = {};

        // Tag filter
        if (tags) {
            const tagArray = (tags as string).split(',');
            query.tags = { $in: tagArray };
        }

        // Search filter
        if (search) {
            query.$text = { $search: search as string };
        }

        // Build sort
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

        const [posts, total] = await Promise.all([
            CommunityPost.find(query)
                .sort(sort)
                .skip(skip)
                .limit(limitNum)
                .populate('authorId', 'username profilePhoto')
                .populate('assetId', 'url thumbnail duration type')
                .lean(),
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

        // Find posts where user has liked
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

// ============= LIKE MANAGEMENT =============

/**
 * Toggle like on a post
 * POST /api/community/posts/:postId/like
 */
export async function toggleLike(req: Request, res: Response): Promise<void> {
    try {
        const { postId } = req.params;
        const userId = req.userId;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Convert string userId to ObjectId
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
            // Unlike
            await post.removeLike(userIdObjectId);
            await User.findByIdAndUpdate(
                userId,
                { $pull: { likedPosts: postId } }
            );
        } else {
            // Like
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
 * Add a comment to a post
 * POST /api/community/posts/:postId/comments
 */
export async function addComment(req: Request, res: Response): Promise<void> {
    try {
        const { postId } = req.params;
        const { content, parentCommentId } = req.body;
        const userId = req.userId;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Convert string userId to ObjectId
        const userIdObjectId = new Types.ObjectId(userId);

        if (!content || content.trim().length === 0) {
            res.status(400).json({ error: 'Comment content is required' });
            return;
        }

        const post = await CommunityPost.findById(postId);

        if (!post) {
            res.status(404).json({ error: 'Post not found' });
            return;
        }

        // Validate parent comment exists if provided
        if (parentCommentId) {
            const parentExists = post.comments.some(
                c => c._id.toString() === parentCommentId
            );
            if (!parentExists) {
                res.status(404).json({ error: 'Parent comment not found' });
                return;
            }
        }

        const commentId = post.addComment(
            userIdObjectId,
            content.trim(),
            parentCommentId ? new Types.ObjectId(parentCommentId) : undefined
        );

        await post.save();

        // Get the created comment with user info
        const updatedPost = await CommunityPost.findById(postId)
            .populate('comments.userId', 'username profilePhoto');

        const newComment = updatedPost?.comments.find(
            c => c._id.toString() === commentId.toString()
        );

        res.status(201).json({
            success: true,
            data: newComment
        });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
}

/**
 * Update a comment
 * PATCH /api/community/posts/:postId/comments/:commentId
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

        // Check authorization
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

        // Check authorization (user owns comment or owns post)
        const isAuthor = comment.userId.toString() === userId.toString();
        const isPostOwner = post.authorId.toString() === userId.toString();

        if (!isAuthor && !isPostOwner) {
            res.status(403).json({ error: 'Not authorized to delete this comment' });
            return;
        }

        // Remove comment and all its replies
        post.comments = post.comments.filter(
            c => c._id.toString() !== commentId &&
                c.parentCommentId?.toString() !== commentId
        );
        post.commentsCount = post.comments.length;

        await post.save();

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
 */
export async function toggleCommentLike(req: Request, res: Response): Promise<void> {
    try {
        const { postId, commentId } = req.params;
        const userId = req.userId;

        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Convert string userId to ObjectId
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
        const { page = 1, limit = 20, parentCommentId } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);

        const post = await CommunityPost.findById(postId)
            .populate('comments.userId', 'username profilePhoto');

        if (!post) {
            res.status(404).json({ error: 'Post not found' });
            return;
        }

        // Filter comments by parentCommentId
        let comments = post.comments;
        if (parentCommentId) {
            comments = comments.filter(
                c => c.parentCommentId?.toString() === parentCommentId
            );
        } else {
            // Only top-level comments (no parent)
            comments = comments.filter(c => !c.parentCommentId);
        }

        // Sort by creation date (newest first)
        comments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        // Paginate
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

/**
 * Search posts by text
 * GET /api/community/search
 */
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

/**
 * Get trending posts (high engagement in recent time)
 * GET /api/community/trending
 */
export async function getTrendingPosts(req: Request, res: Response): Promise<void> {
    try {
        const { limit = 10, days = 7 } = req.query;
        const limitNum = parseInt(limit as string);
        const daysNum = parseInt(days as string);

        const dateThreshold = new Date();
        dateThreshold.setDate(dateThreshold.getDate() - daysNum);

        const posts = await CommunityPost.find({
            publishedAt: { $gte: dateThreshold }
        })
            .sort({ likesCount: -1, 'analytics.views': -1 })
            .limit(limitNum)
            .populate('authorId', 'username profilePhoto')
            .populate('assetId', 'url thumbnail duration type')
            .lean();

        res.json({
            success: true,
            data: posts
        });
    } catch (error) {
        console.error('Error fetching trending posts:', error);
        res.status(500).json({ error: 'Failed to fetch trending posts' });
    }
}


/**
 * Get posts by specific tags
 * GET /api/community/tags/:tag/posts
 */
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

/**
 * Get multiple posts by IDs
 * POST /api/community/posts/batch
 */
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