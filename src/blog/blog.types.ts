export type BlogPostStatus = 'draft' | 'published';

export type BlogPost = {
  id: string;
  clientId: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  imageUrl: string;
  authorName: string;
  seoTitle: string;
  seoDescription: string;
  status: BlogPostStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BlogPostInput = {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  category?: string;
  imageUrl?: string;
  authorName?: string;
  seoTitle?: string;
  seoDescription?: string;
  status: BlogPostStatus;
  publishedAt?: string | null;
};
