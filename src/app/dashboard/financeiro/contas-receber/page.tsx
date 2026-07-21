import { requireModule } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { getAccounts } from "@/lib/finance";
import { AccountsView } from "../_components/accounts-view";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : (v ?? ""));

export default async function ContasReceberPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const user = await requireModule("FINANCEIRO");
  const sp = await searchParams;
  const status = one(sp.status);
  const q = one(sp.q);

  const data = await getAccounts("RECEITA", { status, q });

  return (
    <AccountsView kind="receber" data={data} writable={canWrite(user.role)} status={status} q={q} />
  );
}
