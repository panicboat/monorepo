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

export function ProfileManager() {
  const activeProfileId = useAuthStore(selectActiveProfileId);
  const { profiles, switchProfile, refresh } = useAccountProfiles();
  const [pendingProfileId, setPendingProfileId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProfileView | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = async (profileId: string, request: () => Promise<unknown>) => {
    setError(null);
    setPendingProfileId(profileId);
    try {
      await request();
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "変更に失敗しました");
      return false;
    } finally {
      setPendingProfileId(null);
    }
  };

  const disable = (profile: ProfileView) =>
    change(profile.id, () => authFetch(`/api/profile/${encodeURIComponent(profile.id)}/disable`, { method: "POST" }));
  const enable = (profile: ProfileView) =>
    change(profile.id, () => authFetch(`/api/profile/${encodeURIComponent(profile.id)}/enable`, { method: "POST" }));
  const remove = async (profile: ProfileView) => {
    const removed = await change(profile.id, () =>
      authFetch(`/api/profile/${encodeURIComponent(profile.id)}`, { method: "DELETE" })
    );
    if (removed) setDeleteTarget(null);
  };
  const closeDeleteDialog = () => {
    setError(null);
    setDeleteTarget(null);
  };

  return (
    <section className="py-4">
      <h2 className="text-base font-medium text-text-primary">プロフィール</h2>
      <p className="mt-1 text-sm text-text-secondary">
        プロフィールは互いに別人として表示されます。無効にしたプロフィールは他の人から見えなくなり、いつでも有効に戻せます。
      </p>

      <ul className="mt-4 divide-y divide-border border-y border-border">
        {profiles.map((profile) => {
          const isActive = profile.id === activeProfileId;
          const isPending = pendingProfileId === profile.id;
          return (
            <li key={profile.id} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar src={profile.avatarUrl || undefined} fallback={(profile.displayName || "?").slice(0, 1)} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-text-primary">{profile.displayName || "—"}</p>
                <p className="truncate text-xs text-text-secondary">
                  @{profile.username || "—"}
                  {isActive && <span className="ml-2 text-accent">使用中</span>}
                  {profile.disabled && <span className="ml-2">無効</span>}
                </p>
              </div>
              {!profile.disabled && !isActive && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending}
                    aria-label={`@${profile.username} に切り替える`}
                    onClick={() => switchProfile(profile.id)}
                  >
                    切り替える
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={isPending}
                    aria-label={`@${profile.username} を無効にする`}
                    onClick={() => disable(profile)}
                  >
                    無効にする
                  </Button>
                </>
              )}
              {profile.disabled && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={isPending}
                    aria-label={`@${profile.username} を有効にする`}
                    onClick={() => enable(profile)}
                  >
                    有効にする
                  </Button>
                  {!isActive && (
                    <button
                      type="button"
                      disabled={isPending}
                      aria-label={`@${profile.username} を削除する`}
                      onClick={() => {
                        setError(null);
                        setDeleteTarget(profile);
                      }}
                      className="h-9 rounded-full border border-red-600 px-4 text-sm font-bold text-red-600 disabled:opacity-50"
                    >
                      削除する
                    </button>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-text-secondary">使用中のプロフィールを無効にするには、先に別のプロフィールへ切り替えてください。</p>

      {error && deleteTarget === null && (
        <p role="alert" className="mt-3 text-sm text-error">
          {error}
        </p>
      )}

      <div className="mt-6">
        {adding ? (
          <>
            <ProfileNameForm
              submitLabel="追加して切り替える"
              onSubmit={async (payload) => {
                const res = await authFetch<ProfileResponse>("/api/profile", { method: "POST", body: payload });
                // Refresh the list first; switching to a profile the cached list lacks resolves back to the picker.
                await refresh();
                switchProfile(res.profile.id);
              }}
            />
            <Button type="button" variant="secondary" className="mt-3 w-full" onClick={() => setAdding(false)}>
              キャンセル
            </Button>
          </>
        ) : (
          <Button type="button" variant="secondary" onClick={() => setAdding(true)}>
            プロフィールを追加
          </Button>
        )}
      </div>

      <Dialog.Root open={deleteTarget !== null} onOpenChange={(open) => !open && closeDeleteDialog()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-4">
            <Dialog.Title className="text-base font-bold text-text-primary">
              @{deleteTarget?.username} を削除しますか？
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
              <Dialog.Close asChild>
                <Button variant="secondary" size="sm">キャンセル</Button>
              </Dialog.Close>
              <button
                type="button"
                disabled={pendingProfileId !== null}
                onClick={() => deleteTarget && remove(deleteTarget)}
                className="h-9 rounded-full bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                削除する
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
