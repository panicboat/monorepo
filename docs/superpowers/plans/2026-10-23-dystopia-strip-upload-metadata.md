# Strip Upload Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** アップロードする画像と動画から、撮影した場所などのメタデータを、ブラウザで保存前に取り除く（issue #1675）。

**Architecture:** 画像（GIF・SVG を除くラスター画像）は、どの画面からアップロードしても canvas で JPEG に再エンコードする（投稿は既存の `resizeImage`、アバター・カバー画像にも同じ関数を通す）。再エンコードに失敗したら原本を送らずにエラーにする。動画のうち MP4・MOV（`video/mp4`・`video/quicktime`）は、ISO BMFF の `moov` box の中にある `udta`・`meta` box（`moov` 直下と各 `trak` 直下）の type を `free` に書き換える。サイズを変えないので、`stco`/`co64` のオフセットはずれない。撮影場所（`©xyz`、`com.apple.quicktime.location.ISO6709`）も機種名なども消える（ユーザー決定）。読むのは box の見出しと `moov` だけで、`mdat`（映像の本体）は `Blob.slice` のまま組み直すので、大きな動画を全部メモリに載せない。動画の構造が読めなければ、原本を送らずにエラーにする。GIF は EXIF・GPS の標準の置き場所を持たないので、そのまま送る。SVG もそのまま送る。presigned URL への PUT はアプリを通さなくてもできるので、これは利用者が意図せず位置情報を載せるのを防ぐためのもの。依存は足さない。

**Tech Stack:** Next.js / React / TypeScript / Vitest

**Spec:** issue #1675（https://github.com/panicboat/monorepo/issues/1675）

## Global Constraints

- 作業ディレクトリは `dystopia/frontend`
- 依存パッケージを足さない
- 検証は `pnpm exec tsc --noEmit --incremental false; echo "tsc exit $?"` と `pnpm exec vitest run <files>`。`pnpm lint` は使わない
- エラーの文言: 画像は「画像を読み込めませんでした。別の画像を選んでください」、動画は「動画を読み込めませんでした。別の動画を選んでください」
- コードコメントは英語で 1 行。タスクや issue への言及を書かない
- commit は `git commit -s`。`Co-Authored-By` を付けない

## Review Focus

- 64 bit の box サイズ（size が 1 で、続く 8 byte が実サイズ）の `mdat` が `moov` より前にある動画: `moov` を見つけて書き換える → Task 1 のテスト
- size が 0（ファイルの終わりまで）の最後の box: ファイルの終わりまでとして扱う → Task 1 のテスト
- `moov` がない、または box のサイズがファイルや親 box をはみ出す: エラー → Task 1 のテスト
- 縮小に失敗した画像: 原本を送らずにエラーになり、upload-url も呼ばない → Task 2 のテスト
- `video/webm` など MP4・MOV 以外の動画: そのまま送る → Task 2 のテスト

---

### Task 1: Neutralize the metadata boxes of MP4 and MOV files

**Files:**
- Create: `dystopia/frontend/src/modules/media/lib/video-metadata.ts`
- Create: `dystopia/frontend/src/modules/media/lib/video-metadata.test.ts`

**Interfaces:**
- Produces: `export async function stripVideoMetadata(file: Blob): Promise<Blob>`（戻り値は同じ type・同じ size の Blob。構造が読めなければ `Error` を throw）と `export function isStrippableVideo(type: string): boolean`（`video/mp4` と `video/quicktime` だけ true）

- [ ] **Step 1: Write the failing tests**

テストの中に `box(type: string, ...payload: Uint8Array[]): Uint8Array`（32 bit サイズの box を作る）の helper を置き、合成した MP4 で確かめる。

- `rewrites udta and meta under moov and trak to free`: `ftyp` + `moov[mvhd, udta[©xyz], meta[...], trak[tkhd, udta[...], mdia]]` + `mdat` → 結果の bytes で、`moov` 直下の `udta`・`meta` と `trak` 直下の `udta` の type が `free`、`mvhd`・`tkhd`・`mdia`・`mdat` は元のまま、size と `type` プロパティが元と同じ、それ以外の byte は元と同じ
- `finds moov after a 64-bit mdat`: `ftyp` + size=1 の `mdat`（largesize に実サイズ）+ `moov[udta]` → `udta` が `free`
- `treats a zero-size last box as running to the end`: `ftyp` + `moov[udta]` + size=0 の `mdat` → `udta` が `free`
- `rejects a file without moov`: `ftyp` + `mdat` → throw
- `rejects a box that overruns its parent`: `moov` の中の子の size が `moov` をはみ出す → throw
- `isStrippableVideo`: `video/mp4`・`video/quicktime` が true、`video/webm`・`image/jpeg` が false

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run src/modules/media/lib/video-metadata.test.ts`
Expected: FAIL（モジュールがない）

- [ ] **Step 3: Implement `stripVideoMetadata`**

手順:
1. 先頭から top-level の box の見出しを `file.slice(offset, offset + 16)` で読む。size は big-endian の u32。size が 1 なら offset 8 の u64 が size（見出しは 16 byte）、0 ならファイルの終わりまで。size が見出しより小さいか、ファイルをはみ出すなら throw
2. 最初の `moov` を見つける（なければ throw）。`moov` だけを `Uint8Array` に読む
3. `moov` の子を順に見て、type が `udta`・`meta` なら type の 4 byte を `free` に書き換える。`trak` なら、その子についても同じことをする。子の size が親をはみ出すなら throw
4. `new Blob([file.slice(0, moovStart), moovBytes, file.slice(moovEnd)], { type: file.type })` を返す

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/modules/media/lib/video-metadata.test.ts`
Expected: 全件 pass

- [ ] **Step 5: Commit**

```bash
git add dystopia/frontend/src/modules/media/lib/video-metadata.ts dystopia/frontend/src/modules/media/lib/video-metadata.test.ts
git commit -s -m "feat(dystopia/frontend): neutralize the metadata boxes of MP4 and MOV files"
```

### Task 2: Never upload an original raster image or an unstripped video

**Files:**
- Modify: `dystopia/frontend/src/modules/media/hooks/useMediaUpload.ts`（`prepareUpload`）
- Modify: `dystopia/frontend/src/modules/media/hooks/useMediaUpload.test.tsx`
- Modify: `dystopia/frontend/src/modules/profile/hooks/useMediaUpload.ts`
- Test: `dystopia/frontend/src/modules/profile/hooks/useMediaUpload.test.tsx`（なければ作る。`media/hooks/useMediaUpload.test.tsx` の fetch と `resizeImage` の mock の仕方に合わせる）

**Interfaces:**
- Consumes: Task 1 の `stripVideoMetadata(file: Blob): Promise<Blob>` と `isStrippableVideo(type: string): boolean`、既存の `isResizableImage`・`resizeImage`・`MAIN_MAX_EDGE`・`MAIN_QUALITY`（`media/lib/resize.ts`）

- [ ] **Step 1: Write the failing tests**

投稿（`media/hooks/useMediaUpload.test.tsx`）:
- 既存の「縮小に失敗したら原本を送る」テストを、`uploadMedia` が「画像を読み込めませんでした。別の画像を選んでください」で reject し、`/api/media/upload-url` を呼ばないテストに置き換える
- `strips the metadata boxes of an MP4 before the upload`: `video/mp4` の File → PUT の body が `stripVideoMetadata` の戻り値（mock して確かめる）
- `rejects a video whose structure cannot be read`: `stripVideoMetadata` が reject → 「動画を読み込めませんでした。別の動画を選んでください」、upload-url を呼ばない
- `uploads a WebM video as it is`: `video/webm` → `stripVideoMetadata` を呼ばず、PUT の body が元の File

アバター・カバー（`profile/hooks/useMediaUpload.test.tsx`）:
- `re-encodes a photo before the upload`: `image/jpeg` → `resizeImage(file, MAIN_MAX_EDGE, MAIN_QUALITY)` が呼ばれ、upload-url の body の `contentType` が `image/jpeg`、`filename` の拡張子が `.jpg`、PUT の body が `resizeImage` の戻り値
- `reports an error when the photo cannot be re-encoded`: `resizeImage` が reject → `upload` が null を返し、`error` が「画像を読み込めませんでした。別の画像を選んでください」、upload-url を呼ばない
- `uploads a GIF as it is`: `image/gif` → `resizeImage` を呼ばない

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run src/modules/media/hooks src/modules/profile/hooks`
Expected: 新しいテストが FAIL

- [ ] **Step 3: Implement**

投稿の `prepareUpload` は、縮小の失敗を握りつぶして原本を返す `catch`（`// FALLBACK:`）をやめ、上の文言の `Error` を throw する。`isStrippableVideo(file.type)` なら `stripVideoMetadata` を通し、失敗したら動画の文言の `Error` を throw する。アバター・カバーの `upload` は、`isResizableImage(file.type)` なら `resizeImage(file, MAIN_MAX_EDGE, MAIN_QUALITY)` を通し、`contentType` を `image/jpeg`、`filename` を拡張子 `.jpg` にして送る。ファイル名の置き換えは投稿と同じ `file.name.replace(/\.[^.]+$/, "")` の形にする。

- [ ] **Step 4: Run the tests and tsc**

Run: `pnpm exec vitest run src/modules/media src/modules/profile` と `pnpm exec tsc --noEmit --incremental false; echo "tsc exit $?"`
Expected: 全件 pass、`tsc exit 0`

- [ ] **Step 5: Commit**

```bash
git add dystopia/frontend/src/modules/media/hooks dystopia/frontend/src/modules/profile/hooks
git commit -s -m "fix(dystopia/frontend): strip location metadata from every uploaded photo and video"
```

### Task 3: Update the privacy policy on upload metadata

**Files:**
- Modify: `dystopia/frontend/src/modules/legal/content/privacy.ts`

**Interfaces:**
- Consumes: Task 2 の挙動

- [ ] **Step 1: Replace the original-file paragraph**

「アバターとカバー画像、投稿に添付した動画など、一部のファイルは、アップロードされた元のファイルのまま保存します。元のファイルに撮影した場所などの情報が含まれている場合は、その情報もそのまま保存します。こうした情報を残したくない場合は、アップロードする前に取り除いてください。」を次の文にする:

「本サービスのアプリは、画像（GIF と SVG を除きます）と、MP4 および MOV の動画をアップロードする前に、撮影した場所や機種などの情報を、利用者の端末で取り除きます。GIF、SVG およびその他の形式の動画は、元のファイルのまま保存します。元のファイルに撮影した場所などの情報が含まれている場合は、その情報もそのまま保存します。こうした情報を残したくない場合は、アップロードする前に取り除いてください。」

- [ ] **Step 2: Verify**

Run: `pnpm exec tsc --noEmit --incremental false; echo "tsc exit $?"`、legal のテストがあれば `pnpm exec vitest run src/modules/legal`
Expected: `tsc exit 0`、テストは pass

- [ ] **Step 3: Commit**

```bash
git add dystopia/frontend/src/modules/legal/content/privacy.ts
git commit -s -m "docs(dystopia/frontend): state which uploads have their metadata removed"
```
