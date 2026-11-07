# Video Thumbnail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 動画のアップロード時に 1 コマを切り出してサムネイルとして送り、再生前の動画をそのコマで表示する。

**Architecture:** 画面（frontend）だけを変える。`modules/media/lib/video-thumbnail.ts` が切り出しと表示用の URL を受け持ち、`useMediaUpload` が画像のサムネイルと同じ経路で送る。表示はタイムライン等の `MediaGallery` と、投稿・クチコミの作成中のプレビューで切り替える。

**Tech Stack:** Next.js + React + TypeScript、vitest（happy-dom）。

**Spec:** `docs/superpowers/specs/2026-11-07-dystopia-video-thumbnail-design.md`

## Global Constraints

- 作業ディレクトリは worktree `.worktrees/feat-video-thumbnail`、branch `feat/video-thumbnail`。frontend は `dystopia/frontend`。
- サーバー（monolith）と proto は変えない。依存パッケージを追加しない。
- 切り出す位置は 10 秒。10 秒より短い動画は長さの半分。
- サムネイルは長辺 `THUMBNAIL_MAX_EDGE`（640）、画質 `THUMBNAIL_QUALITY`（0.8）の JPEG（`modules/media/lib/resize.ts` の定数を使う）。
- サムネイルの無い動画の URL には `#t=0.1` を付ける。
- 表紙のある動画は `preload="none"`、表紙の無い動画は `preload="metadata"`。
- 切り出し・サムネイルの発行・サムネイルの PUT のどれが失敗しても、動画はサムネイル無しで登録し、利用者にエラーを出さない。画像のサムネイルの失敗は今のままアップロード全体の失敗。
- 切り出しは画面の中で一度に 1 本ずつ。本体とサムネイルの PUT は今のまま並べて行う。
- 検証: `pnpm vitest run <path>` と `pnpm exec tsc --noEmit --incremental false; echo $?`（パイプしない）。`pnpm lint` は使わない。
- コードは英語。コメントは 1 行で "why not" だけを書き、タスクや修正に触れない。握りつぶすエラーには `// FALLBACK:` を付ける。
- commit は `git commit -s`、`Co-Authored-By` を付けない。メッセージ末尾に `Claude-Session: https://claude.ai/code/session_01N1XYRqnYcbW4DhRzX4PAhJ`。
- subagent を起動しない。

## Review Focus

- 長さが `Infinity` や `NaN` と報告される動画（WebM 等）: 切り出しが止まらずに上限の時間で `null` になる。→ Task 1 の `thumbnailTime` と timeout のテスト。
- 4 本を一度に選んだとき: 切り出しは 1 本ずつ進み、4 本とも登録される。→ Task 1 の直列化のテスト。
- 動画のサムネイルの PUT だけが失敗したとき: 動画は `thumbnailKey` 無しで登録される。画像では reject のまま。→ Task 2。
- 動画のサムネイルのキーの拡張子: 本体の `.mp4` ではなく `.jpg` で発行され、Content-Type は `image/jpeg`。→ Task 2。
- 既存のクチコミの添付を編集で開いたとき: 配信されたサムネイル URL が四角に出る。→ Task 4。

---

### Task 1: 切り出しと表示用 URL

**Files:**
- Create: `dystopia/frontend/src/modules/media/lib/video-thumbnail.ts`
- Test: `dystopia/frontend/src/modules/media/lib/video-thumbnail.test.ts`

**Interfaces:**
- Produces:
  - `THUMBNAIL_TIME_SECONDS = 10`
  - `CAPTURE_TIMEOUT_MS = 5000`
  - `thumbnailTime(duration: number): number`
  - `captureVideoThumbnail(file: Blob): Promise<Blob | null>`
  - `videoSrcWithFrame(url: string): string`（`${url}#t=0.1` を返す）

- [ ] **Step 1: Write the failing tests**（`// @vitest-environment happy-dom`）

```ts
describe("thumbnailTime", () => {
  it.each([[30, 10], [10, 10], [6, 3], [0, 0], [Number.NaN, 0], [Number.POSITIVE_INFINITY, 0], [-1, 0]])(
    "cuts a %s second video at %s seconds", (duration, expected) => {
      expect(thumbnailTime(duration)).toBe(expected);
    });
});

describe("videoSrcWithFrame", () => {
  it("asks the browser to draw the frame at 0.1 seconds", () => {
    expect(videoSrcWithFrame("https://s3/clip.mp4?X-Amz-Signature=abc")).toBe("https://s3/clip.mp4?X-Amz-Signature=abc#t=0.1");
  });
});

describe("captureVideoThumbnail", () => {
  it("gives up with null when the video never becomes drawable", async () => {
    // fake timers; happy-dom never fires loadeddata/seeked
    const result = captureVideoThumbnail(new Blob(["mp4"], { type: "video/mp4" }));
    await vi.advanceTimersByTimeAsync(CAPTURE_TIMEOUT_MS);
    await expect(result).resolves.toBeNull();
  });

  it("starts the next capture only after the previous one settles", async () => {
    // spy on URL.createObjectURL
    const first = captureVideoThumbnail(new Blob(["a"], { type: "video/mp4" }));
    const second = captureVideoThumbnail(new Blob(["b"], { type: "video/mp4" }));
    await vi.advanceTimersByTimeAsync(0);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(CAPTURE_TIMEOUT_MS);
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(CAPTURE_TIMEOUT_MS);
    await expect(Promise.all([first, second])).resolves.toEqual([null, null]);
  });

  it("releases the object URL after giving up", async () => {
    // spy on URL.revokeObjectURL; expect it to be called with the URL createObjectURL returned
  });
});
```

- [ ] **Step 2: Run** `pnpm vitest run src/modules/media/lib/video-thumbnail.test.ts` — Expected: FAIL（モジュールが無い）。

- [ ] **Step 3: Implement** `video-thumbnail.ts`
  - `thumbnailTime`: 有限で正の長さなら `duration >= 10 ? 10 : duration / 2`、それ以外は 0。
  - `captureVideoThumbnail`: モジュール内の Promise の鎖で 1 本ずつ実行する（前の結果が reject でも次へ進む）。
  - 1 本の処理: 画面に出さない `<video>`（`muted`、`playsInline`、`preload="auto"`）に `URL.createObjectURL(file)` を入れる。`loadedmetadata` で `currentTime = thumbnailTime(duration)`、`seeked` で `fitWithin(videoWidth, videoHeight, THUMBNAIL_MAX_EDGE)` の canvas に描き、`toBlob("image/jpeg", THUMBNAIL_QUALITY)`。
  - `error` イベント、canvas の 2D context が無い、`toBlob` が null、`CAPTURE_TIMEOUT_MS` 経過のどれでも `null`（`// FALLBACK:`）。
  - 終わったら（成功・失敗とも）timer を止め、`removeAttribute("src")` と `load()` でデコーダを放し、object URL を revoke する。

- [ ] **Step 4: Run** 同じコマンド — Expected: PASS。

- [ ] **Step 5: Commit** `feat(dystopia/frontend): cut a frame from a video for its thumbnail`

### Task 2: アップロードで動画のサムネイルを送る

**Files:**
- Modify: `dystopia/frontend/src/modules/media/hooks/useMediaUpload.ts`
- Modify: `dystopia/frontend/src/modules/media/types.ts`
- Modify: `dystopia/docs/features/media.md`
- Test: `dystopia/frontend/src/modules/media/hooks/useMediaUpload.test.tsx`

**Interfaces:**
- Consumes: Task 1 の `captureVideoThumbnail`。
- Produces: `UploadedMedia.thumbnailLocalUrl?: string`（送ったサムネイルの object URL。サムネイルを送らなかったときは無い）。

- [ ] **Step 1: Write the failing tests**（既存のテストに `vi.mock("../lib/video-thumbnail", ...)` で `captureVideoThumbnail` を足し、既定は 5 バイトの `image/jpeg` Blob を返す）

```ts
it("uploads a frame of the video as its JPEG thumbnail", async () => {
  const result = await upload(new File(["mp4"], "clip.mp4", { type: "video/mp4" }));
  expect(puts().map((call) => call.contentType)).toEqual(["video/mp4", "image/jpeg"]);
  // the thumbnail's upload-url request
  expect(calls.filter((c) => c.url === "/api/media/upload-url").map((c) => (c.body as Record<string, unknown>).filename))
    .toEqual(["clip.mp4", "thumb-clip.jpg"]);
  expect(registered()).toMatchObject({ mediaKey: "media/p-1/k1.jpg", thumbnailKey: "media/p-1/k2.jpg", contentType: "video/mp4" });
  expect(result.thumbnailLocalUrl).toBe("blob:local");
});

it("cuts the frame from a WebM video too", async () => { /* video/webm → captureVideoThumbnail called, thumbnailKey registered */ });

it("registers the video without a thumbnail when no frame can be cut", async () => {
  thumbnailMocks.captureVideoThumbnail.mockResolvedValue(null);
  const result = await upload(new File(["mp4"], "clip.mp4", { type: "video/mp4" }));
  expect(puts()).toHaveLength(1);
  expect(registered()).not.toHaveProperty("thumbnailKey");
  expect(result).not.toHaveProperty("thumbnailLocalUrl");
});

it("registers the video without a thumbnail when the thumbnail upload fails", async () => {
  // fetch: the PUT to https://s3/put-2 returns ok: false
  await upload(new File(["mp4"], "clip.mp4", { type: "video/mp4" }));
  expect(registered()).not.toHaveProperty("thumbnailKey");
});

it("still rejects a photo whose thumbnail upload fails", async () => {
  // fetch: the PUT to https://s3/put-2 returns ok: false
  await expect(upload(new File(["x"], "photo.png", { type: "image/png" }))).rejects.toThrow("ファイルのアップロードに失敗しました");
});
```

  - 既存の「strips the metadata boxes of an MP4」と「uploads a WebM video as it is」は、`captureVideoThumbnail` が `null` を返す設定にして本体の扱いだけを確かめる形に直す。

- [ ] **Step 2: Run** `pnpm vitest run src/modules/media/hooks/useMediaUpload.test.tsx` — Expected: 新しいテストが FAIL。

- [ ] **Step 3: Implement**
  - `prepareUpload`: `video/` で始まる種別では、メタデータの書き換え（対象形式だけ）の後に `captureVideoThumbnail(file)` を呼び、結果を `thumbnail` にする。
  - サムネイルの PUT は種別に関係なく `filename = thumb-<拡張子を除いた名前>.jpg`、Content-Type `image/jpeg`、mediaType `image` で行う。
  - 動画のサムネイルの発行・PUT の失敗は握りつぶしてサムネイル無しで続ける（`// FALLBACK:`）。画像は今のまま throw する。
  - サムネイルを送れたら `thumbnailLocalUrl: URL.createObjectURL(thumbnail)` を返す。
- [ ] **Step 4: Update** `dystopia/docs/features/media.md` の Rules の「投稿の動画は…」の節に、次を 1 文 1 行で足す。
  - 動画は、送るときに 10 秒の位置（10 秒より短い動画は長さの半分）のコマを、長辺 640 px の JPEG に描いてサムネイルとして送る。
  - 切り出せない、またはサムネイルを送れないときは、サムネイル無しで動画を送り、エラーは表示しない。
  - 切り出しは一度に 1 本ずつ行う。
  - 動画について「サムネイルは作らない」と読める既存の文があれば、上と食い違わないように直す。
- [ ] **Step 5: Run** 同じテストと `pnpm exec tsc --noEmit --incremental false; echo $?` — Expected: PASS、exit 0。
- [ ] **Step 6: Commit** `feat(dystopia/frontend): upload a frame of each video as its thumbnail`

### Task 3: 再生前の動画を表紙で表示する

**Files:**
- Modify: `dystopia/frontend/src/components/ui/media-gallery.tsx`
- Modify: `dystopia/frontend/src/modules/post/components/PostCardBinding.tsx`
- Modify: `dystopia/frontend/src/modules/review/lib/media.ts`
- Test: `dystopia/frontend/src/components/ui/media-gallery.test.tsx`、`dystopia/frontend/src/modules/post/components/PostCardBinding.test.tsx`、`dystopia/frontend/src/modules/review/lib/media.test.ts`

**Interfaces:**
- Consumes: Task 1 の `videoSrcWithFrame`。
- Produces: `PostCardVideo { url: string; thumbnailUrl?: string }`。`galleryOf` の `videos` は `{ url: string; thumbnailUrl: string }[]`。

- [ ] **Step 1: Write the failing tests**

```tsx
// media-gallery.test.tsx — 既存の "plays each given video inline..." を次の 2 つに置き換える
it("shows the thumbnail as the poster and loads nothing until played", () => {
  const html = renderToStaticMarkup(<MediaGallery videos={[{ url: "https://example.com/a.mp4", thumbnailUrl: "https://example.com/a.jpg" }]} />);
  expect(html).toMatch(/<video[^>]*src="https:\/\/example.com\/a.mp4"[^>]*poster="https:\/\/example.com\/a.jpg"[^>]*preload="none"/);
});
it("asks for the frame at 0.1 seconds when the video has no thumbnail", () => {
  const html = renderToStaticMarkup(<MediaGallery videos={[{ url: "https://example.com/b.mp4" }]} />);
  expect(html).toMatch(/<video[^>]*src="https:\/\/example.com\/b.mp4#t=0.1"[^>]*preload="metadata"/);
  expect(html).not.toContain("poster=");
});
```

  - 属性の並びは実装に合わせてよい（`controls`・`playsInline` が残ることも確かめる）。
  - `PostCardBinding.test.tsx`: 動画の `thumbnailUrl: "https://example.com/clip.jpg"` が `poster` に出ること。既存の「plays a video attached to the post」は `thumbnailUrl: ""` のまま `src` が `#t=0.1` 付きになる期待に直す。
  - `media.test.ts`: `galleryOf` が動画の `thumbnailUrl` をそのまま渡すこと（空なら `""`）。

- [ ] **Step 2: Run** 3 つのテスト — Expected: FAIL。
- [ ] **Step 3: Implement**
  - `MediaGallery`: `thumbnailUrl` があれば `poster` と `preload="none"`、無ければ `src={videoSrcWithFrame(url)}` と `preload="metadata"`。今の `preload="metadata"` の 1 行コメントは、表紙の有無に合わせた内容に書き直す。
  - `PostCardBinding`: `videos` に `thumbnailUrl: m.thumbnailUrl` を渡す（空文字は渡さないか空として扱う）。
  - `galleryOf`: 動画に `thumbnailUrl` を足す。
- [ ] **Step 4: Run** 3 つのテストと tsc — Expected: PASS、exit 0。
- [ ] **Step 5: Commit** `feat(dystopia/frontend): show the thumbnail of a video before it plays`

### Task 4: 作成中のプレビューに切り出したコマを出す

**Files:**
- Modify: `dystopia/frontend/src/modules/post/components/PostComposerAttachments.tsx`
- Modify: `dystopia/frontend/src/modules/review/components/ReviewEventAttachments.tsx`
- Test: `dystopia/frontend/src/modules/post/components/PostComposerAttachments.test.tsx`、`dystopia/frontend/src/modules/review/components/ReviewEventAttachments.test.tsx`

**Interfaces:**
- Consumes: Task 1 の `videoSrcWithFrame`、Task 2 の `UploadedMedia.thumbnailLocalUrl`。

- [ ] **Step 1: Write the failing tests**
  - `PostComposerAttachments`: `thumbnailLocalUrl: "blob:thumb-1"` の動画は `<img src="blob:thumb-1">` を出し `<video>` を出さない。`thumbnailLocalUrl` の無い動画は `<video src="blob:video-1#t=0.1">`。
  - `ReviewEventAttachments`:
    - アップロードした動画（`thumbnailLocalUrl: "blob:thumb-9"`）で `onChange` が `{ mediaId: "m-9", mediaType: "video", url: "blob:m-9", thumbnailUrl: "blob:thumb-9" }` を受け取り、四角は `<img src="blob:thumb-9">`。
    - サムネイルの無いアップロード動画は `thumbnailUrl: ""` で、四角は `<video src="blob:m-9#t=0.1">`（既存の「keeps the uploaded video as a video」をこの期待に直す）。
    - 既存の添付 `media("m-2", { mediaType: "video", thumbnailUrl: "https://s3/thumb.jpg" })` の四角は `<img src="https://s3/thumb.jpg">`。
- [ ] **Step 2: Run** 2 つのテスト — Expected: FAIL。
- [ ] **Step 3: Implement**
  - 両方の四角で、動画にサムネイル（`thumbnailLocalUrl` / `thumbnailUrl`）があれば `<img>`、無ければ `<video src={videoSrcWithFrame(...)} muted playsInline>`。
  - `ReviewEventAttachments` の `toReviewMedia` は、動画なら `thumbnailUrl: uploaded.thumbnailLocalUrl ?? ""`、画像は今のまま `localUrl`。
- [ ] **Step 4: Run** 2 つのテスト、`pnpm vitest run`（全件）、tsc — Expected: すべて PASS、exit 0。
- [ ] **Step 5: Commit** `feat(dystopia/frontend): preview the cut frame of a video while composing`
