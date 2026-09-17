import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "tailwindcss";
import { describe, expect, test } from "vitest";

const require = createRequire(import.meta.url);
const appDirectory = path.dirname(fileURLToPath(import.meta.url));

async function buildTypographyCss() {
  const globalsPath = path.join(appDirectory, "globals.css");
  const tailwindPath = require.resolve("tailwindcss/index.css");
  const globals = await readFile(globalsPath, "utf8");
  const tailwind = await readFile(tailwindPath, "utf8");
  const compiler = await compile(
    globals.replace('@import "tailwindcss";', tailwind),
  );

  return compiler.build([
    "text-xs",
    "text-sm",
    "text-base",
    "text-lg",
    "text-xl",
    "text-2xl",
  ]);
}

async function readSource(...segments: string[]) {
  return readFile(path.join(appDirectory, "..", "..", ...segments), "utf8");
}

describe("typography scale", () => {
  test("builds readable text and icon utilities", async () => {
    const css = await buildTypographyCss();

    expect(css).toContain("--text-xs: 0.75rem;");
    expect(css).toContain("--text-sm: 0.875rem;");
    expect(css).toContain("--text-base: 1rem;");
    expect(css).toContain("--text-lg: 1.125rem;");
    expect(css).toContain("--text-xl: 1.25rem;");
    expect(css).toContain("--text-2xl: 1.5rem;");
    expect(css).toContain(".text-2xl {\n    font-size: var(--text-2xl);");
    expect(css).toContain("html {\n  font-size: 100%;\n}");
  });

  test("keeps primary actions at a readable size", async () => {
    const [
      topBar,
      postCard,
      notifications,
      search,
      karte,
      commentList,
      replyList,
      formField,
      imageUpload,
    ] = await Promise.all([
      readSource("src/components/shell/TopBar.tsx"),
      readSource("src/modules/post/components/PostCardBinding.tsx"),
      readSource("src/app/notifications/page.tsx"),
      readSource("src/app/search/page.tsx"),
      readSource("src/modules/karte/components/KarteEntryCard.tsx"),
      readSource("src/modules/post/components/CommentList.tsx"),
      readSource("src/modules/post/components/ReplyList.tsx"),
      readSource("src/components/ui/form-field.tsx"),
      readSource("src/modules/profile/components/ImageUpload.tsx"),
    ]);

    expect(topBar).toContain(
      'className="flex h-11 w-11 items-center justify-center rounded-full',
    );
    expect(postCard).toContain("min-h-11 min-w-11 items-center justify-center");
    expect(notifications).toContain(
      'className="text-sm text-text-secondary underline-offset-2',
    );
    expect(search).toContain(
      '"shrink-0 rounded-full border px-3 py-1 text-sm"',
    );
    expect(karte).toContain(
      'className="mt-2 flex gap-3 text-sm text-muted-foreground"',
    );
    expect(commentList).toContain(
      'className="mt-2 flex items-center gap-4 text-sm"',
    );
    expect(replyList).toContain('className="mt-2 text-sm text-text-muted');
    expect(formField).toContain('className="text-sm text-error"');
    expect(imageUpload).toContain("bg-black/50 text-sm text-white");
  });
});
