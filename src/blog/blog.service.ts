import { randomUUID } from 'crypto';
import { HttpError } from '../shared/errors/httpError';
import { blogRepository } from './blog.repository';
import type { BlogPost, BlogPostInput } from './blog.types';

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);

const sortPosts = (posts: BlogPost[]): BlogPost[] =>
  [...posts].sort((left, right) =>
    (right.publishedAt ?? right.createdAt).localeCompare(left.publishedAt ?? left.createdAt)
  );

class BlogService {
  async listAdminPosts(clientId: string): Promise<BlogPost[]> {
    const posts = await blogRepository.listPosts();
    return sortPosts(posts.filter((post) => post.clientId === clientId));
  }

  async listPublishedPosts(): Promise<BlogPost[]> {
    const posts = await blogRepository.listPosts();
    return sortPosts(posts.filter((post) => post.status === 'published'));
  }

  async getPublishedPost(slug: string): Promise<BlogPost | null> {
    const posts = await this.listPublishedPosts();
    return posts.find((post) => post.slug === slug) ?? null;
  }

  async createPost(clientId: string, input: BlogPostInput): Promise<BlogPost> {
    const now = new Date().toISOString();
    const slug = await this.getUniqueSlug(input.slug || input.title);
    const post: BlogPost = {
      id: randomUUID(),
      clientId,
      title: input.title,
      slug,
      excerpt: input.excerpt ?? '',
      content: input.content,
      category: input.category ?? 'Salon tips',
      imageUrl: input.imageUrl ?? '',
      authorName: input.authorName ?? 'QRschedule team',
      seoTitle: input.seoTitle ?? input.title,
      seoDescription: input.seoDescription ?? input.excerpt ?? '',
      status: input.status,
      publishedAt: input.status === 'published' ? input.publishedAt ?? now : input.publishedAt ?? null,
      createdAt: now,
      updatedAt: now
    };

    return blogRepository.savePost(post);
  }

  async updatePost(clientId: string, postId: string, input: BlogPostInput): Promise<BlogPost> {
    const posts = await blogRepository.listPosts();
    const existing = posts.find((post) => post.id === postId && post.clientId === clientId);

    if (!existing) {
      throw new HttpError(404, 'Blog post was not found');
    }

    const slugSource = input.slug || input.title;
    const nextSlug =
      slugify(slugSource) === existing.slug
        ? existing.slug
        : await this.getUniqueSlug(slugSource, existing.id);
    const now = new Date().toISOString();
    const nextPost: BlogPost = {
      ...existing,
      title: input.title,
      slug: nextSlug,
      excerpt: input.excerpt ?? '',
      content: input.content,
      category: input.category ?? 'Salon tips',
      imageUrl: input.imageUrl ?? '',
      authorName: input.authorName ?? 'QRschedule team',
      seoTitle: input.seoTitle ?? input.title,
      seoDescription: input.seoDescription ?? input.excerpt ?? '',
      status: input.status,
      publishedAt:
        input.status === 'published'
          ? input.publishedAt ?? existing.publishedAt ?? now
          : input.publishedAt ?? null,
      updatedAt: now
    };

    return blogRepository.savePost(nextPost);
  }

  async deletePost(clientId: string, postId: string): Promise<void> {
    const posts = await blogRepository.listPosts();
    const existing = posts.find((post) => post.id === postId && post.clientId === clientId);

    if (!existing) {
      throw new HttpError(404, 'Blog post was not found');
    }

    await blogRepository.deletePost(postId);
  }

  private async getUniqueSlug(value: string, currentPostId?: string): Promise<string> {
    const baseSlug = slugify(value) || `post-${Date.now()}`;
    const posts = await blogRepository.listPosts();
    const usedSlugs = new Set(
      posts
        .filter((post) => post.id !== currentPostId)
        .map((post) => post.slug)
    );

    if (!usedSlugs.has(baseSlug)) {
      return baseSlug;
    }

    for (let index = 2; index < 1000; index += 1) {
      const candidate = `${baseSlug}-${index}`;
      if (!usedSlugs.has(candidate)) {
        return candidate;
      }
    }

    return `${baseSlug}-${randomUUID().slice(0, 8)}`;
  }
}

export const blogService = new BlogService();
