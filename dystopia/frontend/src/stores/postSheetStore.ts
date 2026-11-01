import { create } from "zustand";

interface PostSheetState {
  postId: string | null;
  session: number;
  open: boolean;
  openPost: (postId: string) => void;
  close: () => void;
}

export const usePostSheetStore = create<PostSheetState>()((set) => ({
  postId: null,
  session: 0,
  open: false,
  openPost: (postId) => set((state) => ({ postId, session: state.session + 1, open: true })),
  // Keep the post while closing: dropping it would empty the sheet before it slides out.
  close: () => set({ open: false }),
}));
