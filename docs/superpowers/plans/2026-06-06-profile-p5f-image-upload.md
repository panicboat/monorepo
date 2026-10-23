# Profile P5f: avatar / cover image upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** プロフィール編集モーダルに avatar / cover の画像アップロードを追加する。media flow（upload-url → presigned PUT → register）でアップロードし、`SaveProfileMedia`（P5a の `useProfile().saveMedia`）で profile に紐付ける。

**Architecture:** **Additive**（既存 EditProfileModal/ProfilePage に画像ピッカーを追記）。アップロードは既存 BFF（`/api/media/upload-url`・`/api/media/register`）+ P5a の `/api/profile/media` を再利用。画像はピック時に即保存（テキスト項目の 保存 とは独立、`SaveProfileMedia` は別 RPC のため）。

**Tech Stack:** Next.js 16 / React 19 / TypeScript / 既存 media BFF + connect-es backend。

**Spec:** `docs/superpowers/specs/2026-06-05-profile-ui-design.md`（Image upload deferred → P5f）。前提: P5a–P5e 完了。

---

## Context for the implementer

- worktree（ここの中だけ編集）: `/Users/takanokenichi/GitHub/panicboat/monorepo/.claude/worktrees/feat-profile-slice`。frontend app root: `services/frontend/workspace`。branch `feat/profile-slice`。**push しない**。
- 検索は `/usr/bin/grep` / `/usr/bin/find`。alias `@/` → `src/`。
- **テストランナー無し** → `pnpm exec tsc --noEmit` + `pnpm build`。視覚確認は `/dev/ui`（オーケストレータ）。**依存追加禁止**。
- **実アップロードは object storage（minio/S3）が必要**でローカル stack には未配置。よって本 increment の検証は **型 + build + ピッカー UI の視覚確認**まで（presigned PUT の実行は storage 配備後）。

### 既存パターン（確定）

- **media flow**（旧 onboarding 前例）:
  1. `POST /api/media/upload-url` body `{ filename, contentType, mediaType: "IMAGE" }` → `{ uploadUrl, mediaKey, mediaId }`。
  2. `PUT <uploadUrl>`（headers `{ "Content-Type": file.type }`, body: file、**認証ヘッダ不要**＝presigned）。
  3. `POST /api/media/register` body `{ mediaId, mediaKey, mediaType, filename, contentType, sizeBytes }` → `{ media: { id, url, ... } | null }`。
- **profile 紐付け**: P5a の `useProfile().saveMedia({ avatarMediaId?, coverMediaId? })`（PUT 相当、`POST /api/profile/media` → `SaveProfileMedia`）。
- `authFetch`（`@/lib/auth/fetch`）= `{ method, body }`、JSON + Bearer 自動付与。presigned PUT は素の `fetch` を使う（認証不要・JSON でない）。
- `getAuthToken`（`@/lib/swr`）。
- EditProfileModal（P5c）/ ProfilePage（P5c）は既存。`useProfile` は `saveMedia` を返す（P5a）。

## File Structure

- Create: `src/modules/profile/hooks/useMediaUpload.ts`
- Modify: `src/modules/profile/hooks/index.ts`（export 追記）
- Create: `src/modules/profile/components/ImageUpload.tsx`
- Modify: `src/modules/profile/components/EditProfileModal.tsx`（avatar/cover ピッカー + `onSaveMedia` prop）
- Modify: `src/app/profile/page.tsx`（`onSaveMedia={saveMedia}` を渡す）
- Modify: `src/app/dev/ui/page.tsx`（ImageUpload デモ）

---

## Task 1: useMediaUpload フック + ImageUpload コンポーネント

**Files:** Create `useMediaUpload.ts`; Modify `hooks/index.ts`; Create `ImageUpload.tsx`。

- [ ] **Step 1: `src/modules/profile/hooks/useMediaUpload.ts`**

```ts
"use client";

import { useState } from "react";
import { authFetch } from "@/lib/auth/fetch";
import { getAuthToken } from "@/lib/swr";

export interface UploadResult {
  mediaId: string;
  url: string;
}

export function useMediaUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File): Promise<UploadResult | null> => {
    if (!getAuthToken()) {
      setError("ログインが必要です");
      return null;
    }
    setUploading(true);
    setError(null);
    try {
      const mediaType = file.type.startsWith("video/") ? "VIDEO" : "IMAGE";
      const { uploadUrl, mediaKey, mediaId } = await authFetch<{
        uploadUrl: string;
        mediaKey: string;
        mediaId: string;
      }>("/api/media/upload-url", {
        method: "POST",
        body: { filename: file.name, contentType: file.type, mediaType },
      });

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("アップロードに失敗しました");

      const reg = await authFetch<{ media: { id: string; url: string } | null }>(
        "/api/media/register",
        {
          method: "POST",
          body: {
            mediaId,
            mediaKey,
            mediaType,
            filename: file.name,
            contentType: file.type,
            sizeBytes: file.size,
          },
        }
      );

      return { mediaId, url: reg.media?.url || URL.createObjectURL(file) };
    } catch (e) {
      setError(e instanceof Error ? e.message : "アップロードに失敗しました");
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading, error };
}
```

- [ ] **Step 2: `src/modules/profile/hooks/index.ts` に export 追記**

末尾に追加:

```ts
export { useMediaUpload } from "./useMediaUpload";
```

- [ ] **Step 3: `src/modules/profile/components/ImageUpload.tsx`**

```tsx
"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { useMediaUpload } from "@/modules/profile/hooks/useMediaUpload";

interface ImageUploadProps {
  shape: "avatar" | "cover";
  url?: string;
  onUploaded: (mediaId: string, url: string) => void;
}

export function ImageUpload({ shape, url, onUploaded }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading } = useMediaUpload();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const res = await upload(file);
      if (res) onUploaded(res.mediaId, res.url);
    }
    e.target.value = "";
  };

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={uploading}
      className={cn(
        "group relative overflow-hidden border border-border bg-input-bg",
        shape === "avatar" ? "h-20 w-20 rounded-full" : "h-28 w-full rounded-md"
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-xs text-text-muted">
          {shape === "avatar" ? "アバター" : "カバー画像"}
        </span>
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
        {uploading ? "アップロード中…" : "変更"}
      </span>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </button>
  );
}
```

- [ ] **Step 4: 型チェック**

Run: `cd services/frontend/workspace && pnpm exec tsc --noEmit 2>&1 | tail -15`
Expected: 新規ファイルの型エラーなし。

---

## Task 2: EditProfileModal に avatar/cover ピッカーを統合

**Files:** Modify `src/modules/profile/components/EditProfileModal.tsx`。

- [ ] **Step 1: import 追加**

`EditProfileModal.tsx` の import 群に追加:

```tsx
import { ImageUpload } from "@/modules/profile/components/ImageUpload";
```

- [ ] **Step 2: props に `onSaveMedia` を追加**

`EditProfileModalProps` インターフェースに追加:

```tsx
  onSaveMedia: (payload: { avatarMediaId?: string; coverMediaId?: string }) => Promise<void>;
```

（`open`/`onOpenChange`/`profile`/`isCast`/`onSave` の並びに足す。関数引数の分割代入 `({ open, onOpenChange, profile, isCast, onSave })` にも `onSaveMedia` を追加する。）

- [ ] **Step 3: プレビュー用ローカル state を追加**

`const [saving, setSaving] = useState(false);` の近くに追加:

```tsx
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [coverUrl, setCoverUrl] = useState(profile.coverUrl);
```

- [ ] **Step 4: scroll 領域の先頭（最初の `<FormField label="表示名" ...>` の直前）に画像ピッカーを追加**

```tsx
            <div className="flex flex-col gap-3">
              <ImageUpload
                shape="cover"
                url={coverUrl || undefined}
                onUploaded={async (mediaId, url) => {
                  setCoverUrl(url);
                  await onSaveMedia({ coverMediaId: mediaId });
                }}
              />
              <ImageUpload
                shape="avatar"
                url={avatarUrl || undefined}
                onUploaded={async (mediaId, url) => {
                  setAvatarUrl(url);
                  await onSaveMedia({ avatarMediaId: mediaId });
                }}
              />
            </div>
```

（画像はピック時に即 `onSaveMedia` で保存。テキスト項目の「保存」フロー（`handleSave`/`buildPayload`）は変更しない。）

- [ ] **Step 5: 型チェック**

Run: `cd services/frontend/workspace && pnpm exec tsc --noEmit 2>&1 | tail -15`
Expected: 型エラーなし。

---

## Task 3: ProfilePage で onSaveMedia を渡す + dev/ui デモ

**Files:** Modify `src/app/profile/page.tsx`, `src/app/dev/ui/page.tsx`。

- [ ] **Step 1: `src/app/profile/page.tsx` の `<EditProfileModal>` に `onSaveMedia` を追加**

既存の `<EditProfileModal ... onSave={...} />` に prop を追加:

```tsx
        onSaveMedia={async (payload) => {
          await saveMedia(payload);
        }}
```

（`useProfile()` の分割代入に `saveMedia` を含める: `const { profile, loading, error, saveProfile, saveMedia } = useProfile();`）

- [ ] **Step 2: `src/app/dev/ui/page.tsx` に ImageUpload デモを追記**

import 群に追加:

```tsx
import { ImageUpload } from "@/modules/profile/components/ImageUpload";
```

`</main>` の直前にセクションを追加（onUploaded は no-op、UI 確認用）:

```tsx
      <section className="flex flex-col gap-3">
        <ImageUpload shape="cover" onUploaded={() => {}} />
        <ImageUpload shape="avatar" onUploaded={() => {}} />
      </section>
```

- [ ] **Step 3: 型チェック**

Run: `cd services/frontend/workspace && pnpm exec tsc --noEmit 2>&1 | tail -15`
Expected: 型エラーなし。

---

## Task 4: ビルド検証してコミット

**Files:** なし（検証 + コミット）。

- [ ] **Step 1: 本番ビルド**

Run: `cd services/frontend/workspace && pnpm build 2>&1 | tail -25`
Expected: 成功。型エラーなし。`/profile` / `/dev/ui` がビルド出力に存在。

- [ ] **Step 2: コミット（signoff、Co-Authored-By 無し）**

```bash
cd services/frontend/workspace
git add src/modules/profile/hooks src/modules/profile/components src/app/profile/page.tsx src/app/dev/ui/page.tsx
git commit -s -m "feat(profile): add avatar/cover image upload in edit modal"
```
（push しない。視覚確認はオーケストレータが `/dev/ui` の ImageUpload（avatar 円 / cover バナーのピッカー）を確認。実アップロードは object storage 配備後に e2e。）

---

## Deferred（P5f では実施しない）

- object storage（minio/S3）のローカル配備 + 実アップロード e2e。
- 円アバターのクロップ UI。
- 投稿/メディアギャラリー（posts スライス）。
- 通知/外観 設定、フォロー機能（他スライス）。

## Self-Review（作成者チェック済）

- **Spec coverage（P5f 範囲）**: Surface 2 の画像（avatar/cover）。media flow（upload-url→presigned PUT→register）を `useMediaUpload` に集約、`ImageUpload` でピック、`onSaveMedia`（P5a `saveMedia`→`SaveProfileMedia`）で即保存。
- **Additive で build-green**: BFF は既存（`/api/media/*`・`/api/profile/media`）再利用。新規 hook/component + EditProfileModal/ProfilePage への最小追記。依存追加なし。
- **Placeholder 無し**: hook / component / 各編集箇所すべて具体コード。
- **型整合**: `useMediaUpload().upload(file)` → `{mediaId,url}`。`ImageUpload` props（shape/url/onUploaded）。`EditProfileModal` の新 prop `onSaveMedia` と ProfilePage の `saveMedia`（P5a）一致。upload-url/register の body 形は既存 BFF route と一致（sizeBytes=number→route が BigInt 化）。
- **検証**: `tsc` + `pnpm build` + `/dev/ui` ピッカー UI。実アップロードは storage 依存のため範囲外（明記）。
