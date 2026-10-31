import { create } from "zustand";

interface PostDeletionState {
  // Feed lists keep posts outside SWR, so cards hide themselves as soon as the post is deleted.
  deleted: Record<string, true>;
  markDeleted: (postId: string) => void;
}

export const usePostDeletionStore = create<PostDeletionState>()((set) => ({
  deleted: {},
  markDeleted: (postId) => set((s) => ({ deleted: { ...s.deleted, [postId]: true } })),
}));
