"use client";

import { useState } from "react";
import { InvitationCard } from "@/components/features/invitation/InvitationCard";
import { RitualModal } from "@/components/features/invitation/RitualModal";
import { SealedBadge } from "@/components/features/invitation/SealedBadge";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSealed, setIsSealed] = useState(false);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleCompleteRitual = () => {
    setIsSealed(true);
    setIsModalOpen(false);
  };

  return (
    <div className="bg-black text-slate-200 min-h-screen flex flex-col items-center justify-center p-4 font-sans select-none">
      <div className="w-full max-w-md space-y-6">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-700 flex-shrink-0 border border-slate-600"></div>
          <div className="space-y-3 w-full">
            <div className="bg-slate-800 p-3 rounded-r-2xl rounded-bl-2xl text-sm w-fit">
              招待状を送るから、確認してね💕
            </div>

            {!isSealed ? (
              <InvitationCard onClick={handleOpenModal} />
            ) : (
              <SealedBadge />
            )}
          </div>
        </div>
      </div>

      <RitualModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onComplete={handleCompleteRitual}
      />
    </div>
  );
}
