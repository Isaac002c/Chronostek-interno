import { redirect } from "next/navigation";

export default async function LegacyCommercialEditContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/juridico/contratos/${encodeURIComponent(id)}/edit`);
}
