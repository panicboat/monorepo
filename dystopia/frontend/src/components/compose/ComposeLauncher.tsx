"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { FlowerMenu } from "@/components/ui/flower-menu";
import { PostComposerModal } from "@/modules/post/components/PostComposerModal";
import { useMyKarteAccess } from "@/modules/karte/hooks/useMyKarteAccess";
import { useAuthStore, selectRole } from "@/stores/authStore";
import { ComposeToDialog } from "./ComposeToDialog";
import { COMPOSE_ICONS, COMPOSE_LABELS } from "./compose-icons";
import { resolveComposeKinds, type ComposeKind } from "./resolveComposeKinds";

const VARIANTS = {
  fab: {
    spread: "up-left",
    radius: 96,
    className: "fixed bottom-20 right-4 z-40 md:hidden",
    triggerClassName:
      "flex h-14 w-14 items-center justify-center rounded-full bg-gradient-brand text-white shadow-brand-glow active:scale-95",
    content: <Plus className="size-7" />,
  },
  sidebar: {
    spread: "up",
    radius: 92,
    className: "mt-3",
    triggerClassName:
      "w-full rounded-full bg-gradient-brand py-3 text-center font-bold text-white shadow-brand-glow active:scale-95",
    content: "作成する",
  },
} as const;

export function ComposeLauncher({ variant }: { variant: keyof typeof VARIANTS }) {
  const role = useAuthStore(selectRole);
  const { hasAccess: karteAccess } = useMyKarteAccess();
  const [kind, setKind] = useState<ComposeKind>("post");
  const [open, setOpen] = useState(false);
  const { content, ...menu } = VARIANTS[variant];
  const kinds = resolveComposeKinds({ role, karteAccess });
  const close = () => setOpen(false);

  return (
    <>
      <FlowerMenu
        {...menu}
        label="作成メニュー"
        items={kinds.map((id) => ({ id, label: COMPOSE_LABELS[id], icon: COMPOSE_ICONS[id] }))}
        onSelect={(id) => { setKind(id as ComposeKind); setOpen(true); }}
      >
        {content}
      </FlowerMenu>
      <PostComposerModal open={open && kind === "post"} onClose={close} />
      <ComposeToDialog kind={kind === "post" ? "message" : kind} open={open && kind !== "post"} onClose={close} />
    </>
  );
}
