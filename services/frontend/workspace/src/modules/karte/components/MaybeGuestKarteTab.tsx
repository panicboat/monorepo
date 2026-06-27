"use client";

import { useMyKarteAccess } from "../hooks/useMyKarteAccess";
import { GuestKarteTab } from "./GuestKarteTab";

export function MaybeGuestKarteTab({
  guestAccountId,
  isGuest,
}: {
  guestAccountId: string;
  isGuest: boolean;
}) {
  const { hasAccess, loading } = useMyKarteAccess();
  if (loading) return null;
  if (!hasAccess) return null;
  if (!isGuest) return null;
  return <GuestKarteTab guestAccountId={guestAccountId} />;
}
