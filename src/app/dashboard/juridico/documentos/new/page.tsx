import { redirect } from "next/navigation";

export default function LegacyNewLegalDocumentPage() {
  redirect("/dashboard/juridico/documentos");
}
