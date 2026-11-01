import { create } from "zustand";

interface PostSheetState {
  postId: string | null;
  focusComment: boolean;
  session: number;
  open: boolean;
  openPost: (postId: string) => void;
  openToComment: (postId: string) => void;
  close: () => void;
}

export const usePostSheetStore = create<PostSheetState>()((set) => ({
  postId: null,
  focusComment: false,
  session: 0,
  open: false,
  openPost: (postId) => set((state) => ({ postId, focusComment: false, session: state.session + 1, open: true })),
  openToComment: (postId) => set((state) => ({ postId, focusComment: true, session: state.session + 1, open: true })),
  // Keep the post while closing: dropping it would empty the sheet before it slides out.
  close: () => set({ open: false }),
}));
