import { Router } from 'express';
import {
  createPost,
  updatePost,
  deletePost,
  getPostById,
  getPosts,
  getUserPosts,
  getUserLikedPosts,
  toggleLike,
  getPostLikes,
  addComment,
  updateComment,
  deleteComment,
  toggleCommentLike,
  getComments,
  searchPosts,
  getTrendingPosts,
  getPostsByTag,
  getPostsByIds
} from '../controller/communityPost.controller';
import auth from '../middleware/auth.middleware';

const router = Router();

// ============= POST MANAGEMENT =============
router.post('/posts', auth ,createPost);                    // POST /api/community/posts
router.patch('/posts/:postId', auth ,updatePost);           // PATCH /api/community/posts/:postId
router.delete('/posts/:postId', auth, deletePost);          // DELETE /api/community/posts/:postId

// ============= POST RETRIEVAL =============
router.get('/posts', auth ,getPosts);                       // GET /api/community/posts
router.get('/posts/:postId', auth, getPostById);            // GET /api/community/posts/:postId
router.post('/posts/batch', auth, getPostsByIds);           // POST /api/community/posts/batch

// ============= USER-SPECIFIC POSTS =============
router.get('/users/:userId/posts', auth, getUserPosts);     // GET /api/community/users/:userId/posts
router.get('/users/:userId/liked', auth, getUserLikedPosts); // GET /api/community/users/:userId/liked

// ============= LIKE MANAGEMENT =============
router.post('/posts/:postId/like', auth, toggleLike);       // POST /api/community/posts/:postId/like
router.get('/posts/:postId/likes', auth, getPostLikes);     // GET /api/community/posts/:postId/likes

// ============= COMMENT MANAGEMENT =============
router.post('/posts/:postId/comments', auth, addComment);   // POST /api/community/posts/:postId/comments
router.get('/posts/:postId/comments', auth, getComments);   // GET /api/community/posts/:postId/comments
router.patch('/posts/:postId/comments/:commentId', auth, updateComment); // PATCH /api/community/posts/:postId/comments/:commentId
router.delete('/posts/:postId/comments/:commentId', auth, deleteComment); // DELETE /api/community/posts/:postId/comments/:commentId
router.post('/posts/:postId/comments/:commentId/like', auth, toggleCommentLike); // POST /api/community/posts/:postId/comments/:commentId/like

// ============= SEARCH & DISCOVERY =============
router.get('/search',auth, searchPosts);                   // GET /api/community/search
router.get('/trending', auth, getTrendingPosts);            // GET /api/community/trending
router.get('/tags/:tag/posts',auth, getPostsByTag);        // GET /api/community/tags/:tag/posts

export default router;