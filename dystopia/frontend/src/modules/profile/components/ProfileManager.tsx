"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth/fetch";
import { useAuthStore, selectActiveProfileId } from "@/stores/authStore";
import { useAccountProfiles } from "@/modules/profile/context/AccountProfilesContext";
import { ProfileNameForm } from "@/modules/profile/components/ProfileNameForm";
import type { ProfileView } from "@/modules/profile/types";

interface ProfileResponse {
  profile: ProfileView;
}

const ACTIONS_CLASS = "flex w-full justify-end gap-2 sm:w-auto";

function handleOf(profile: ProfileView): string {
  return profile.username ? `@${profile.username}` : "このプロフィール";
}

export function ProfileManager() {
  const activeProfileId = useAuthStore(selectActiveProfileId);
  const { profiles, switchProfile, refresh, append } = useAccountProfiles();
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProfileView | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = async (request: () => Promise<unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await request();
      return true;
    } catch (err) {
      // FALLBACK: Use a generic message when the failure carries none.
      setError(err instanceof Error ? err.message : "変更に失敗しました");
      return false;
    } finally {
      // Reload after a refusal too: it usually means the list on screen is no longer what the server holds.
      await refresh();
      setBusy(false);
    }
  };

  const disable = (profile: ProfileView) =>
    change(() => authFetch(`/api/profile/${encodeURIComponent(profile.id)}/disable`, { method: "POST" }));
  const enable = (profile: ProfileView) =>
    change(() => authFetch(`/api/profile/${encodeURIComponent(profile.id)}/enable`, { method: "POST" }));
  const remove = async (profile: ProfileView) => {
    const removed = await change(() =>
      authFetch(`/api/profile/${encodeURIComponent(profile.id)}`, { method: "DELETE" })
    );
    if (removed) setDeleteTarget(null);
  };
  const openDeleteDialog = (profile: ProfileView) => {
    setError(null);
    setDeleteTarget(profile);
  };
  const closeDeleteDialog = () => {
    if (busy) return;
    setError(null);
    setDeleteTarget(null);
  };

  return (
    <section className="py-4">
      <h2 className="text-base font-medium text-text-primary">プロフィール</h2>
      <p className="mt-1 text-sm text-text-secondary">
        プロフィールは互いに別人として表示されます。無効にしたプロフィールは他の人から見えなくなり、いつでも有効に戻せます。
      </p>

      {profiles.length === 0 ? (
        <p className="mt-4 text-sm text-text-secondary">読み込み中…</p>
      ) : (
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {profiles.map((profile) => {
            const isActive = profile.id === activeProfileId;
            const handle = handleOf(profile);
            return (
              <li key={profile.id} className="flex flex-wrap items-center gap-3 py-3">
                <Avatar src={profile.avatarUrl || undefined} fallback={(profile.displayName || "?").slice(0, 1)} size="md" />
                <div className="min-w-[8rem] flex-1">
                  <p className="truncate text-sm font-bold text-text-primary">{profile.displayName || "—"}</p>
                  <p className="truncate text-xs text-text-secondary">
                    @{profile.username || "—"}
                    {isActive && <span className="ml-2 text-accent">使用中</span>}
                    {profile.disabled && <span className="ml-2">無効</span>}
                    {profile.isPrivate && <span className="ml-2">鍵付き</span>}
                  </p>
                </div>
                {!profile.disabled && !isActive && (
                  <div className={ACTIONS_CLASS}>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      aria-label={`${handle} に切り替える`}
                      onClick={() => switchProfile(profile.id)}
                    >
                      切り替える
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      aria-label={`${handle} を無効にする`}
                      onClick={() => disable(profile)}
                    >
                      無効にする
                    </Button>
                  </div>
                )}
                {profile.disabled && (
                  <div className={ACTIONS_CLASS}>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      aria-label={`${handle} を有効にする`}
                      onClick={() => enable(profile)}
                    >
                      有効にする
                    </Button>
                    {!isActive && (
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={`${handle} を削除する`}
                        onClick={() => openDeleteDialog(profile)}
                        className="h-9 rounded-full border border-red-600 px-4 text-sm font-bold text-red-600 disabled:opacity-50"
                      >
                        削除する
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-xs text-text-secondary">使用中のプロフィールを無効にするには、先に別のプロフィールへ切り替えてください。</p>

      {error && deleteTarget === null && (
        <p role="alert" className="mt-3 text-sm text-error">
          {error}
        </p>
      )}

      {profiles.length > 0 && (
        <div className="mt-6">
          {adding ? (
            <ProfileNameForm
              submitLabel="追加して切り替える"
              onCancel={() => setAdding(false)}
              onSubmit={async (payload) => {
                const res = await authFetch<ProfileResponse>("/api/profile", { method: "POST", body: payload });
                // Put the profile into the list first; switching to a profile the cached list lacks resolves back to the picker.
                await append(res.profile);
                switchProfile(res.profile.id);
              }}
            />
          ) : (
            <Button type="button" variant="secondary" onClick={() => setAdding(true)}>
              プロフィールを追加
            </Button>
          )}
        </div>
      )}

      <Dialog.Root open={deleteTarget !== null} onOpenChange={(open) => !open && closeDeleteDialog()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-4">
            <Dialog.Title className="text-base font-bold text-text-primary">
              {deleteTarget ? handleOf(deleteTarget) : ""} を削除しますか？
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-text-secondary">
              このプロフィールの投稿・コメント・フォロー・メッセージ・レビューが削除され、元に戻せません。カルテの記録は残ります。
            </Dialog.Description>
            {error && (
              <p role="alert" className="mt-3 text-sm text-error">
                {error}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={closeDeleteDialog}>
                キャンセル
              </Button>
              <button
                type="button"
                disabled={busy}
                onClick={() => deleteTarget && remove(deleteTarget)}
                className="h-9 rounded-full bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy ? "削除中…" : "削除する"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
