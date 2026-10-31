import { create } from "zustand";

interface PostPinState {
  // Feed lists keep posts outside SWR, so every card of the author reads the latest pin from here.
  pinnedPostIdByAuthor: Record<string, string | null>;
  setPinned: (authorProfileId: string, postId: string | null) => void;
}

export const usePostPinStore = create<PostPinState>()((set) => ({
  pinnedPostIdByAuthor: {},
  setPinned: (authorProfileId, postId) =>
    set((s) => ({ pinnedPostIdByAuthor: { ...s.pinnedPostIdByAuthor, [authorProfileId]: postId } })),
}));
