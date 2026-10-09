export type ShellLayout = "scrolling" | "viewport";

// A message thread scrolls inside itself and keeps its composer in view, so it needs the space between the shell's bars, not the document.
export function resolveShellLayout(pathname: string): ShellLayout {
  return /^\/messages\/[^/]+$/.test(pathname) ? "viewport" : "scrolling";
}
