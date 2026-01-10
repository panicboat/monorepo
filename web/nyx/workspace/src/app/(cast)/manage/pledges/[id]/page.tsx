import { ResponsiveMainContainer } from "@/modules/shell/components/ResponsiveMainContainer";
import { CastReservationDetail } from "./components/CastReservationDetail";

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6 w-full max-w-lg mx-auto pb-24">
      <CastReservationDetail reservationId={id} />
    </div>
  );
}
