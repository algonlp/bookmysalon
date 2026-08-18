import { Router } from 'express';
import { blogController } from '../controllers/blog.controller';
import { asyncHandler } from '../middlewares/asyncHandler';
import { requirePlatformAdminAccess } from '../middlewares/requirePlatformAdminAccess';

export const blogRouter = Router();

const requireBlogAdminAccess = [asyncHandler(requirePlatformAdminAccess)];

blogRouter.get(
  '/platform/clients/:clientId/blog-posts',
  ...requireBlogAdminAccess,
  asyncHandler(blogController.listAdminPosts)
);
blogRouter.post(
  '/platform/clients/:clientId/blog-posts',
  ...requireBlogAdminAccess,
  asyncHandler(blogController.createPost)
);
blogRouter.put(
  '/platform/clients/:clientId/blog-posts/:postId',
  ...requireBlogAdminAccess,
  asyncHandler(blogController.updatePost)
);
blogRouter.delete(
  '/platform/clients/:clientId/blog-posts/:postId',
  ...requireBlogAdminAccess,
  asyncHandler(blogController.deletePost)
);

blogRouter.get('/public/blog-posts', asyncHandler(blogController.listPublishedPosts));
blogRouter.get('/public/blog-posts/:slug', asyncHandler(blogController.getPublishedPost));
