import { redirect } from "next/navigation";

export default async function LegacyEditLegalDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/juridico/documentos/${encodeURIComponent(id)}`);
}
