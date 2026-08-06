import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { HttpError } from '../../shared/errors/httpError';
import { blogService } from '../../blog/blog.service';

const postInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  slug: z.string().trim().optional().or(z.literal('')),
  excerpt: z.string().trim().optional().or(z.literal('')),
  content: z.string().trim().min(1, 'Content is required'),
  category: z.string().trim().optional().or(z.literal('')),
  imageUrl: z.string().trim().optional().or(z.literal('')),
  authorName: z.string().trim().optional().or(z.literal('')),
  seoTitle: z.string().trim().optional().or(z.literal('')),
  seoDescription: z.string().trim().optional().or(z.literal('')),
  status: z.enum(['draft', 'published']),
  publishedAt: z.string().trim().optional().nullable()
});

const getClientId = (req: Request): string => {
  const clientId = req.params.clientId;

  if (!clientId) {
    throw new HttpError(400, 'Client id is required');
  }

  return clientId;
};

export const blogController = {
  async listAdminPosts(req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.status(200).json({ posts: await blogService.listAdminPosts(getClientId(req)) });
  },

  async createPost(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const post = await blogService.createPost(getClientId(req), postInputSchema.parse(req.body));
    res.status(201).json({ post });
  },

  async updatePost(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const postId = z.string().uuid('Valid blog post id is required').parse(req.params.postId);
    const post = await blogService.updatePost(getClientId(req), postId, postInputSchema.parse(req.body));
    res.status(200).json({ post });
  },

  async deletePost(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const postId = z.string().uuid('Valid blog post id is required').parse(req.params.postId);
    await blogService.deletePost(getClientId(req), postId);
    res.status(204).end();
  },

  async listPublishedPosts(_req: Request, res: Response, _next: NextFunction): Promise<void> {
    res.status(200).json({ posts: await blogService.listPublishedPosts() });
  },

  async getPublishedPost(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const slug = z.string().trim().min(1).parse(req.params.slug);
    const post = await blogService.getPublishedPost(slug);

    if (!post) {
      throw new HttpError(404, 'Blog post was not found');
    }

    res.status(200).json({ post });
  }
};
