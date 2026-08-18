import type { BlogPost } from '../blog.types';
import { createDefaultBlogState, type BlogState, type BlogStore } from '../blog.store';

export class BlogMemoryStore implements BlogStore {
  private state: BlogState = createDefaultBlogState();

  async listPosts(): Promise<BlogPost[]> {
    return [...this.state.posts];
  }

  async savePosts(posts: BlogPost[]): Promise<void> {
    this.state.posts = [...posts];
  }

  async reset(): Promise<void> {
    this.state = createDefaultBlogState();
  }
}
