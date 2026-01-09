import { ResponsiveMainContainer } from "@/modules/shell/components/ResponsiveMainContainer";
import { ReservationDetail } from "@/modules/ritual/components/ReservationDetail";

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6 w-full max-w-lg mx-auto pb-24">
      <ReservationDetail reservationId={id} />
    </div>
  );
}
