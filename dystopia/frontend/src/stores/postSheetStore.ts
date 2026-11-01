import { create } from "zustand";

export type PostDetailTab = "comments" | "quotes";

interface PostSheetState {
  postId: string | null;
  tab: PostDetailTab;
  session: number;
  open: boolean;
  openPost: (postId: string, tab?: PostDetailTab) => void;
  close: () => void;
}

export const usePostSheetStore = create<PostSheetState>()((set) => ({
  postId: null,
  tab: "comments",
  session: 0,
  open: false,
  openPost: (postId, tab = "comments") => set((state) => ({ postId, tab, session: state.session + 1, open: true })),
  // Keep the post while closing: dropping it would empty the sheet before it slides out.
  close: () => set({ open: false }),
}));
