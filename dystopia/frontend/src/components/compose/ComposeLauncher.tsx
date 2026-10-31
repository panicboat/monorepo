"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useSWRConfig } from "swr";
import { FlowerMenu } from "@/components/ui/flower-menu";
import { PostComposerSheet } from "@/modules/post/components/PostComposerSheet";
import { revalidatePostLists } from "@/modules/post/lib/revalidate";
import { ScheduleBulkSheet } from "@/modules/schedule/components/ScheduleBulkSheet";
import { useAuthStore, selectActiveProfileId, selectRole } from "@/stores/authStore";
import { usePostFeedStore } from "@/stores/postFeedStore";
import { ComposeToSheet } from "./ComposeToSheet";
import { COMPOSE_ICONS, COMPOSE_LABELS } from "./compose-icons";
import { resolveComposeKinds, type ComposeKind } from "./resolveComposeKinds";

const VARIANTS = {
  fab: {
    spread: "up-left",
    radius: 116,
    className: "fixed bottom-20 right-4 z-40 md:hidden",
    triggerClassName:
      "flex h-14 w-14 items-center justify-center rounded-full bg-gradient-brand text-white shadow-brand-glow active:scale-95",
    content: <Plus className="size-7" />,
  },
  sidebar: {
    spread: "up",
    radius: 116,
    className: "mt-3",
    triggerClassName:
      "flex min-h-[47px] w-full items-center justify-center gap-2 rounded-full bg-gradient-brand font-bold text-white shadow-brand-glow active:scale-95",
    content: (
      <>
        <Plus className="size-5" />
        作成する
      </>
    ),
  },
} as const;

interface Composing {
  kind: ComposeKind;
  session: number;
  open: boolean;
}

export function ComposeLauncher({ variant }: { variant: keyof typeof VARIANTS }) {
  const role = useAuthStore(selectRole);
  const profileId = useAuthStore(selectActiveProfileId);
  const { mutate } = useSWRConfig();
  const notifyPostCreated = usePostFeedStore((s) => s.notifyPostCreated);
  // Keep the chosen kind after closing: dropping it would unmount the sheet before it slides out.
  const [composing, setComposing] = useState<Composing | null>(null);
  const { content, ...menu } = VARIANTS[variant];
  const kinds = resolveComposeKinds({ role });
  const close = () => setComposing((current) => current && { ...current, open: false });
  const onScheduleSaved = () => {
    mutate((key) => typeof key === "string" && (key.startsWith("/api/posts") || key.startsWith("/api/feed")), undefined, { revalidate: true });
    void revalidatePostLists();
    notifyPostCreated();
  };

  return (
    <>
      <FlowerMenu
        {...menu}
        label="作成メニュー"
        items={kinds.map((id) => ({ id, label: COMPOSE_LABELS[id], icon: COMPOSE_ICONS[id] }))}
        onSelect={(id) =>
          setComposing((current) => ({ kind: id as ComposeKind, session: (current?.session ?? 0) + 1, open: true }))
        }
      >
        {content}
      </FlowerMenu>
      <PostComposerSheet open={composing?.kind === "post" && composing.open} onClose={close} />
      {composing?.kind === "schedule" && profileId && (
        <ScheduleBulkSheet key={composing.session} profileId={profileId} open={composing.open} onClose={close} onSaved={onScheduleSaved} />
      )}
      {composing && composing.kind !== "post" && composing.kind !== "schedule" && (
        <ComposeToSheet key={composing.session} kind={composing.kind} open={composing.open} onClose={close} />
      )}
    </>
  );
}
