import { env } from '../config/env';
import { isTestEnvironment } from '../shared/runtimeEnv';
import type { BlogPost } from './blog.types';
import type { BlogStore } from './blog.store';
import { BlogFileStore } from './storage/blogFile.store';
import { BlogMemoryStore } from './storage/blogMemory.store';

const createStore = (): BlogStore => {
  if (isTestEnvironment() || env.CLIENT_PLATFORM_STORAGE === 'memory') {
    return new BlogMemoryStore();
  }

  return new BlogFileStore();
};

class BlogRepository {
  constructor(private readonly store: BlogStore = createStore()) {}

  listPosts(): Promise<BlogPost[]> {
    return this.store.listPosts();
  }

  async savePost(post: BlogPost): Promise<BlogPost> {
    const posts = await this.store.listPosts();
    const existingIndex = posts.findIndex((entry) => entry.id === post.id);

    if (existingIndex >= 0) {
      posts[existingIndex] = post;
    } else {
      posts.push(post);
    }

    await this.store.savePosts(posts);
    return post;
  }

  async deletePost(postId: string): Promise<boolean> {
    const posts = await this.store.listPosts();
    const nextPosts = posts.filter((post) => post.id !== postId);
    await this.store.savePosts(nextPosts);
    return nextPosts.length !== posts.length;
  }

  resetForTests(): Promise<void> {
    return this.store.reset();
  }
}

export const blogRepository = new BlogRepository();
