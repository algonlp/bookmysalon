import type { BlogPost } from './blog.types';

export type BlogState = {
  posts: BlogPost[];
};

export type BlogStore = {
  listPosts(): Promise<BlogPost[]>;
  savePosts(posts: BlogPost[]): Promise<void>;
  reset(): Promise<void>;
};

export const createDefaultBlogState = (): BlogState => ({
  posts: []
});
