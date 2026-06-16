"use client";

export function ComposerFAB() {
  return (
    <button
      type="button"
      onClick={() => alert("投稿機能は近日対応です")}
      className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-brand text-2xl text-white shadow-brand-glow active:scale-95 md:hidden"
      aria-label="投稿を作成"
    >
      ＋
    </button>
  );
}
