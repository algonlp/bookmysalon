import { constants } from 'fs';
import { access, mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import type { BlogPost } from '../blog.types';
import { createDefaultBlogState, type BlogState, type BlogStore } from '../blog.store';

export class BlogFileStore implements BlogStore {
  private readonly storagePath: string;
  private state: BlogState = createDefaultBlogState();
  private loaded = false;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(storagePath = resolve(process.cwd(), 'data', 'blog-posts.json')) {
    this.storagePath = storagePath;
  }

  private async ensureStorageFile(): Promise<void> {
    try {
      await access(this.storagePath, constants.F_OK);
    } catch {
      await mkdir(dirname(this.storagePath), { recursive: true });
      await writeFile(this.storagePath, JSON.stringify(createDefaultBlogState(), null, 2), 'utf-8');
    }
  }

  private async loadStateFromDisk(): Promise<void> {
    await this.ensureStorageFile();
    const rawState = await readFile(this.storagePath, 'utf-8');
    const parsedState = rawState.trim()
      ? (JSON.parse(rawState) as Partial<BlogState>)
      : createDefaultBlogState();
    this.state = {
      posts: Array.isArray(parsedState.posts) ? parsedState.posts : []
    };
    this.loaded = true;
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) {
      await this.loadStateFromDisk();
    }
  }

  private async withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
    const nextOperation = this.writeChain.then(operation, operation);
    this.writeChain = nextOperation.then(
      () => undefined,
      () => undefined
    );
    return nextOperation;
  }

  async listPosts(): Promise<BlogPost[]> {
    await this.ensureLoaded();
    return [...this.state.posts];
  }

  async savePosts(posts: BlogPost[]): Promise<void> {
    await this.withWriteLock(async () => {
      await this.loadStateFromDisk();
      this.state.posts = [...posts];
      await mkdir(dirname(this.storagePath), { recursive: true });
      await writeFile(this.storagePath, JSON.stringify(this.state, null, 2), 'utf-8');
    });
  }

  async reset(): Promise<void> {
    await this.savePosts([]);
  }
}
