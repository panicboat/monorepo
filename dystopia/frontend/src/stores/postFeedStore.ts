import { create } from "zustand";

interface PostFeedState {
  version: number;
  notifyPostCreated: () => void;
}

// Increment the signal so non-SWR feed consumers refetch after a post.
export const usePostFeedStore = create<PostFeedState>()((set) => ({
  version: 0,
  notifyPostCreated: () => set((s) => ({ version: s.version + 1 })),
}));
