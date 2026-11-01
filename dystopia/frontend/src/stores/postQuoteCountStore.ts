import { create } from "zustand";

interface PostQuoteCountState {
  // Feed lists keep posts outside SWR, so cards read the latest known count from here.
  counts: Record<string, number>;
  setCount: (postId: string, count: number) => void;
  addOne: (postId: string, baseCount: number) => void;
}

export const usePostQuoteCountStore = create<PostQuoteCountState>()((set) => ({
  counts: {},
  setCount: (postId, count) => set((s) => ({ counts: { ...s.counts, [postId]: count } })),
  addOne: (postId, baseCount) =>
    set((s) => ({ counts: { ...s.counts, [postId]: (s.counts[postId] ?? baseCount) + 1 } })),
}));
