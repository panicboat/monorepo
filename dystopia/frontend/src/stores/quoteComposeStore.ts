import { create } from "zustand";
import type { PostView } from "@/modules/post/lib/post-view";

interface QuoteComposeState {
  post: PostView | null;
  session: number;
  open: boolean;
  openQuote: (post: PostView) => void;
  close: () => void;
}

export const useQuoteComposeStore = create<QuoteComposeState>()((set) => ({
  post: null,
  session: 0,
  open: false,
  openQuote: (post) => set((state) => ({ post, session: state.session + 1, open: true })),
  // Keep the post while closing: dropping it would empty the sheet before it slides out.
  close: () => set({ open: false }),
}));
