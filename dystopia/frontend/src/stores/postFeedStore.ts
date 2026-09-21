import { create } from "zustand";

interface PostFeedState {
  /** Bumped whenever a post is created via the global composer (ComposerFAB). */
  version: number;
  notifyPostCreated: () => void;
}

export const usePostFeedStore = create<PostFeedState>()((set) => ({
  version: 0,
  notifyPostCreated: () => set((s) => ({ version: s.version + 1 })),
}));
