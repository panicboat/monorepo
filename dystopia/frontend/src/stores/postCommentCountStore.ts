import { create } from "zustand";

interface PostCommentCountState {
  // Feed lists keep posts outside SWR, so cards read the latest fetched count from here.
  counts: Record<string, number>;
  setCount: (postId: string, count: number) => void;
}

export const usePostCommentCountStore = create<PostCommentCountState>()((set) => ({
  counts: {},
  setCount: (postId, count) => set((s) => ({ counts: { ...s.counts, [postId]: count } })),
}));
