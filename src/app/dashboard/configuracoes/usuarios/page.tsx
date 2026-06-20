import Link from "next/link";
import { Plus, Pencil, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/session";
import { formatDate } from "@/lib/format";
import {
  ROLE_LABELS,
  USER_STATUS_LABELS,
} from "@/lib/enums";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { DeleteButton } from "@/components/form/delete-button";
import { deleteUser } from "./actions";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  // requireModule("CONFIGURACOES") já garante isAdmin.
  const current = await requireModule("CONFIGURACOES");

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    include: { costCenter: { select: { code: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <>
      <PageHeader title="Usuários e Permissões" description="Gerencie acessos e perfis (RBAC) do sistema.">
        <Button asChild>
          <Link href="/dashboard/configuracoes/usuarios/new">
            <Plus />
            Novo usuário
          </Link>
        </Button>
      </PageHeader>

      {users.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum usuário" description="Cadastre o primeiro usuário." />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Centro de custo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead className="w-1 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <span className="font-medium">{u.name}</span>
                    {u.id === current.id && (
                      <Badge tone="info" className="ml-2">você</Badge>
                    )}
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </TableCell>
                  <TableCell>
                    <Badge tone="purple">{ROLE_LABELS[u.role]}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.costCenter ? `${u.costCenter.code} · ${u.costCenter.name}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge tone={u.status === "ATIVO" ? "success" : "neutral"}>
                      {USER_STATUS_LABELS[u.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button asChild variant="ghost" size="icon">
                        <Link href={`/dashboard/configuracoes/usuarios/${u.id}/edit`}>
                          <Pencil />
                        </Link>
                      </Button>
                      {u.id !== current.id && (
                        <DeleteButton action={deleteUser.bind(null, u.id)} iconOnly confirmMessage={`Desativar/excluir o usuário "${u.name}"?`} />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
