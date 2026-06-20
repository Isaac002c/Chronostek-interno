import { prisma } from "@/lib/prisma";
import type { CategoryType } from "@prisma/client";
import type { Option } from "@/lib/enums";

export async function getUserOptions(): Promise<Option[]> {
  const rows = await prisma.user.findMany({
    where: { deletedAt: null, status: "ATIVO" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => ({ value: r.id, label: r.name }));
}

export async function getClientOptions(): Promise<Option[]> {
  const rows = await prisma.client.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => ({ value: r.id, label: r.name }));
}

export async function getCostCenterOptions(): Promise<Option[]> {
  const rows = await prisma.costCenter.findMany({
    where: { active: true },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });
  return rows.map((r) => ({ value: r.id, label: `${r.code} · ${r.name}` }));
}

export async function getCategoryOptions(type?: CategoryType): Promise<Option[]> {
  const rows = await prisma.financialCategory.findMany({
    where: { active: true, ...(type ? { type } : {}) },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });
  return rows.map((r) => ({ value: r.id, label: `${r.code} · ${r.name}` }));
}

export async function getProjectOptions(): Promise<Option[]> {
  const rows = await prisma.project.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => ({ value: r.id, label: r.name }));
}

export async function getContractOptions(): Promise<Option[]> {
  const rows = await prisma.contract.findMany({
    where: { deletedAt: null },
    select: { id: true, title: true, client: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    value: r.id,
    label: `${r.title} — ${r.client.name}`,
  }));
}

export async function getLegalContractOptions(): Promise<Option[]> {
  const rows = await prisma.legalContract.findMany({
    where: { deletedAt: null },
    select: { id: true, title: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({ value: r.id, label: r.title }));
}
