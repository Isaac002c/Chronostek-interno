import { redirect } from "next/navigation";

export default async function LegacyCommercialNewContractPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const clientId = Array.isArray(params.clientId)
    ? params.clientId[0]
    : params.clientId;
  redirect(
    clientId
      ? `/dashboard/juridico/contratos/new?clientId=${encodeURIComponent(clientId)}`
      : "/dashboard/juridico/contratos/new",
  );
}
