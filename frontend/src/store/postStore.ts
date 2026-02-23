import { create } from 'zustand';
import type { Post, PostStatus, CreatePostData, UpdatePostData, PaginatedResponse } from '../types';
import { postService } from '../services';

interface PostState {
  posts: Post[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  statusFilter: PostStatus | 'all';
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchPosts: (page?: number) => Promise<void>;
  createPost: (data: CreatePostData) => Promise<Post>;
  updatePost: (id: number, data: UpdatePostData) => Promise<Post>;
  deletePost: (id: number) => Promise<void>;
  cancelPost: (id: number) => Promise<void>;
  setStatusFilter: (status: PostStatus | 'all') => void;
  clearError: () => void;
}

export const usePostStore = create<PostState>()((set, get) => ({
  posts: [],
  totalCount: 0,
  currentPage: 1,
  pageSize: 10,
  statusFilter: 'all',
  isLoading: false,
  error: null,

  fetchPosts: async (page = 1) => {
    set({ isLoading: true, error: null });
    try {
      const { statusFilter, pageSize } = get();
      const filters = {
        page,
        page_size: pageSize,
        ...(statusFilter !== 'all' && { status: statusFilter }),
      };

      const response: PaginatedResponse<Post> = await postService.list(filters);
      set({
        posts: response.results,
        totalCount: response.count,
        currentPage: page,
        isLoading: false,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch posts';
      set({ error: message, isLoading: false });
    }
  },

  createPost: async (data: CreatePostData) => {
    set({ isLoading: true, error: null });
    try {
      const post = await postService.create(data);
      set((state) => ({
        posts: [post, ...state.posts],
        totalCount: state.totalCount + 1,
        isLoading: false,
      }));
      return post;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create post';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  updatePost: async (id: number, data: UpdatePostData) => {
    set({ isLoading: true, error: null });
    try {
      const updatedPost = await postService.update(id, data);
      set((state) => ({
        posts: state.posts.map((p) => (p.id === id ? updatedPost : p)),
        isLoading: false,
      }));
      return updatedPost;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update post';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  deletePost: async (id: number) => {
    set({ isLoading: true, error: null });
    try {
      await postService.delete(id);
      set((state) => ({
        posts: state.posts.filter((p) => p.id !== id),
        totalCount: state.totalCount - 1,
        isLoading: false,
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete post';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  cancelPost: async (id: number) => {
    set({ isLoading: true, error: null });
    try {
      const cancelledPost = await postService.cancel(id);
      set((state) => ({
        posts: state.posts.map((p) => (p.id === id ? cancelledPost : p)),
        isLoading: false,
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to cancel post';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  setStatusFilter: (status: PostStatus | 'all') => {
    set({ statusFilter: status });
    get().fetchPosts(1);
  },

  clearError: () => set({ error: null }),
}));

export default usePostStore;
