import { redirect } from "next/navigation";

export default function LegacyLegalNewContractPage() {
  redirect("/dashboard/juridico/contratos/new");
}
