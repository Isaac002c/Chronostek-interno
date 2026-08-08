import Link from "next/link";
import { Building2, Filter, ListChecks, MessagesSquare, Telescope, UserCheck } from "lucide-react";
import { Prisma, ProspectBusinessFit, ProspectQualification, ProspectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";
type SP = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value ?? "";
const fitLabel: Record<ProspectBusinessFit, string> = { TELUN_M_PLUS: "Telun M+", TELUN_TECHNOLOGY: "Telun Tecnologia", BOTH: "Ambos", UNQUALIFIED: "Não qualificado" };
const fitTone: Record<ProspectBusinessFit, "info" | "purple" | "success" | "neutral"> = { TELUN_M_PLUS: "purple", TELUN_TECHNOLOGY: "info", BOTH: "success", UNQUALIFIED: "neutral" };

export default async function ProspectingPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireModule("PROSPECCAO");
  const sp = await searchParams;
  const fit = one(sp.fit);
  const qualification = one(sp.qualification);
  const status = one(sp.status);
  const agent = one(sp.agent);
  const view = one(sp.view);
  const where: Prisma.ProspectWhereInput = { tenantId: "default" };
  if (fit && fit in ProspectBusinessFit) where.businessFit = fit as ProspectBusinessFit;
  if (qualification && qualification in ProspectQualification) where.qualification = qualification as ProspectQualification;
  if (status && status in ProspectStatus) where.status = status as ProspectStatus;
  if (agent) where.assignedAgent = { slug: agent };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [prospects, lists, total, newToday, qualified, a, b, mplus, technology, both, contactable, withInstagram, replied] = await Promise.all([
    prisma.prospect.findMany({ where, orderBy: [{ overallScore: "desc" }, { updatedAt: "desc" }], take: 100, include: { assignedAgent: { select: { name: true } }, contacts: { select: { type: true } } } }),
    prisma.prospectList.findMany({ where: { tenantId: "default" }, orderBy: { updatedAt: "desc" }, take: 30, include: { _count: { select: { prospects: true } }, prospects: { include: { prospect: { select: { qualification: true, businessFit: true } } } } } }),
    prisma.prospect.count({ where: { tenantId: "default" } }), prisma.prospect.count({ where: { tenantId: "default", createdAt: { gte: today } } }),
    prisma.prospect.count({ where: { tenantId: "default", status: { in: ["QUALIFIED", "READY_FOR_OUTREACH"] } } }), prisma.prospect.count({ where: { tenantId: "default", qualification: "A" } }),
    prisma.prospect.count({ where: { tenantId: "default", qualification: "B" } }), prisma.prospect.count({ where: { tenantId: "default", businessFit: "TELUN_M_PLUS" } }),
    prisma.prospect.count({ where: { tenantId: "default", businessFit: "TELUN_TECHNOLOGY" } }), prisma.prospect.count({ where: { tenantId: "default", businessFit: "BOTH" } }),
    prisma.prospect.count({ where: { tenantId: "default", OR: [{ commercialPhone: { not: null } }, { commercialWhatsApp: { not: null } }, { commercialEmail: { not: null } }] } }),
    prisma.prospect.count({ where: { tenantId: "default", instagram: { not: null } } }), prisma.prospect.count({ where: { tenantId: "default", status: { in: ["REPLIED", "INTERESTED"] } } }),
  ]);
  return <div className="space-y-6">
    <PageHeader title="Prospecção" description="Banco central de inteligência comercial compartilhado entre Telun M+ e Telun Tecnologia." />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
      <StatCard label="Prospects" value={total} icon={Building2} /><StatCard label="Novos hoje" value={newToday} icon={Telescope} tone="info" />
      <StatCard label="Qualificados" value={qualified} icon={UserCheck} tone="success" /><StatCard label="A / B" value={`${a} / ${b}`} icon={ListChecks} tone="warning" />
      <StatCard label="M+ / Tecnologia" value={`${mplus} / ${technology}`} /><StatCard label="Ambos" value={both} tone="success" />
      <StatCard label="Responderam" value={replied} icon={MessagesSquare} tone="info" hint={`${contactable} contatáveis · ${withInstagram} com Instagram`} />
    </div>
    {view === "listas" && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{lists.map((list) => {
      const rows = list.prospects.map((item) => item.prospect); const ab = rows.filter((item) => item.qualification === "A" || item.qualification === "B").length;
      return <Card key={list.id} className="p-5"><div className="flex justify-between gap-3"><div><h2 className="font-semibold">{list.name}</h2><p className="mt-1 text-sm text-muted-foreground">{list.description || "Lista de prospecção"}</p></div><Badge>{list.status}</Badge></div><div className="mt-4 grid grid-cols-2 gap-2 text-sm"><span>Total <b>{list._count.prospects}</b></span><span>A/B <b>{ab}</b></span><span>Telun M+ <b>{rows.filter((item) => item.businessFit === "TELUN_M_PLUS").length}</b></span><span>Tecnologia <b>{rows.filter((item) => item.businessFit === "TELUN_TECHNOLOGY").length}</b></span></div></Card>;
    })}</div>}
    <Card className="p-4"><form className="grid gap-3 md:grid-cols-5">
      <select name="fit" defaultValue={fit} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="">Todos os destinos</option>{Object.entries(fitLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select name="qualification" defaultValue={qualification} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="">Todas as notas</option>{["A", "B", "C", "D", "UNQUALIFIED"].map((value) => <option key={value}>{value}</option>)}</select>
      <select name="status" defaultValue={status} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="">Todos os status</option>{Object.keys(ProspectStatus).map((value) => <option key={value}>{value}</option>)}</select>
      <input type="hidden" name="view" value={view} /><Button type="submit"><Filter /> Filtrar</Button><Button asChild variant="ghost"><Link href="/dashboard/prospeccao">Limpar</Link></Button>
    </form></Card>
    {prospects.length === 0 ? <EmptyState icon={Telescope} title="Nenhum prospect encontrado" description="Lucas poderá preencher esta área por jobs, importações ou ferramentas autorizadas." /> : <Card><Table><TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>Local / segmento</TableHead><TableHead>Destino</TableHead><TableHead className="text-center">Nota</TableHead><TableHead className="text-center">M+</TableHead><TableHead className="text-center">Tech</TableHead><TableHead>Contatos</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{prospects.map((item) => <TableRow key={item.id}>
      <TableCell><Link href={`/dashboard/prospeccao/${item.id}`} className="font-medium text-primary hover:underline">{item.companyName}</Link><div className="text-xs text-muted-foreground">{item.websiteDomain || item.assignedAgent?.name || "—"}</div></TableCell>
      <TableCell>{[item.city, item.state].filter(Boolean).join("/") || "—"}<div className="text-xs text-muted-foreground">{item.segment || "Sem segmento"}</div></TableCell><TableCell><Badge tone={fitTone[item.businessFit]}>{fitLabel[item.businessFit]}</Badge></TableCell>
      <TableCell className="text-center"><Badge tone={item.qualification === "A" ? "success" : item.qualification === "B" ? "info" : "neutral"}>{item.qualification}</Badge></TableCell><TableCell className="text-center tabular-nums">{item.marketingFitScore}</TableCell><TableCell className="text-center tabular-nums">{item.technologyFitScore}</TableCell>
      <TableCell className="text-xs">{item.contacts.map((contact) => contact.type).filter((value, index, all) => all.indexOf(value) === index).slice(0, 3).join(" · ") || "—"}</TableCell><TableCell><Badge>{item.status}</Badge></TableCell>
    </TableRow>)}</TableBody></Table></Card>}
  </div>;
}
