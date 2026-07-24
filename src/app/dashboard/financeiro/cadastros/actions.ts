"use server";

import { BankAccountType, FinancialProductType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import {
  num,
  optBool,
  optDate,
  optEnum,
  optInt,
  optStr,
  requireFinancePermission,
  str,
  type ActionState,
} from "@/lib/actions";

function refresh() {
  revalidatePath("/dashboard/financeiro/cadastros");
  revalidatePath("/dashboard/financeiro/lancamentos/new");
}

export async function saveSupplierAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireFinancePermission("MANAGE_REGISTRIES");
  if ("error" in auth) return auth;
  const id = optStr(formData, "id");
  const name = str(formData, "name");
  if (!name) return { error: "Informe o nome do fornecedor." };
  try {
    const duplicate = await prisma.supplier.findFirst({
      where: {
        tenantId: "default",
        deletedAt: null,
        name: { equals: name, mode: "insensitive" },
        ...(id ? { id: { not: id } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) return { error: "Já existe um fornecedor com este nome." };
    const data = {
      name,
      legalName: optStr(formData, "legalName"),
      document: optStr(formData, "document"),
      email: optStr(formData, "email"),
      phone: optStr(formData, "phone"),
      category: optStr(formData, "category"),
      defaultCategoryId: optStr(formData, "defaultCategoryId"),
      defaultCostCenterId: optStr(formData, "defaultCostCenterId"),
      responsibleId: optStr(formData, "responsibleId"),
      bankDetailsMasked: optStr(formData, "bankDetailsMasked"),
      bankDetailsRestricted: true,
      notes: optStr(formData, "notes"),
      active: !optBool(formData, "inactive"),
    };
    const before = id
      ? await prisma.supplier.findUnique({ where: { id } })
      : null;
    const supplier = id
      ? await prisma.supplier.update({ where: { id }, data })
      : await prisma.supplier.create({ data });
    await writeAudit({
      userId: auth.user.id,
      action: id ? "update" : "create",
      entity: "Supplier",
      entityId: supplier.id,
      before,
      after: { ...data, bankDetailsMasked: data.bankDetailsMasked ? "***" : null },
      origin: "financeiro/cadastros",
    });
    refresh();
    return { ok: true };
  } catch {
    return { error: "Não foi possível salvar o fornecedor." };
  }
}

export async function saveBankAccountAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireFinancePermission("MANAGE_REGISTRIES");
  if ("error" in auth) return auth;
  const id = optStr(formData, "id");
  const name = str(formData, "name");
  const type = (optEnum(formData, "type") ?? "CORRENTE") as BankAccountType;
  if (!name) return { error: "Informe o nome da conta." };
  if (!(type in BankAccountType)) return { error: "Tipo de conta inválido." };
  try {
    const duplicate = await prisma.bankAccount.findFirst({
      where: {
        tenantId: "default",
        deletedAt: null,
        name: { equals: name, mode: "insensitive" },
        ...(id ? { id: { not: id } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) return { error: "Já existe uma conta com este nome." };
    const data = {
      name,
      bank: optStr(formData, "bank"),
      agency: optStr(formData, "agency"),
      number: optStr(formData, "number"),
      type,
      initialBalance: num(formData, "initialBalance"),
      initialBalanceDate: optDate(formData, "initialBalanceDate"),
      responsibleId: optStr(formData, "responsibleId"),
      sensitiveDataRestricted: true,
      notes: optStr(formData, "notes"),
      active: !optBool(formData, "inactive"),
    };
    const before = id
      ? await prisma.bankAccount.findUnique({ where: { id } })
      : null;
    const account = id
      ? await prisma.bankAccount.update({ where: { id }, data })
      : await prisma.bankAccount.create({ data });
    await writeAudit({
      userId: auth.user.id,
      action: id ? "update" : "create",
      entity: "BankAccount",
      entityId: account.id,
      before: before
        ? { ...before, agency: "***", number: "***" }
        : null,
      after: { ...data, agency: data.agency ? "***" : null, number: data.number ? "***" : null },
      origin: "financeiro/cadastros",
    });
    refresh();
    return { ok: true };
  } catch {
    return { error: "Não foi possível salvar a conta bancária." };
  }
}

export async function savePaymentMethodAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireFinancePermission("MANAGE_REGISTRIES");
  if ("error" in auth) return auth;
  const id = optStr(formData, "id");
  const code = str(formData, "code").toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  const name = str(formData, "name");
  const settlementDays = optInt(formData, "settlementDays") ?? 0;
  const feeRate = num(formData, "feeRate");
  if (!code || !name) return { error: "Código e nome são obrigatórios." };
  if (settlementDays < 0 || feeRate < 0) return { error: "Prazo e taxa não podem ser negativos." };
  try {
    const data = {
      code,
      name,
      settlementDays,
      feeRate,
      bankAccountId: optStr(formData, "bankAccountId"),
      notes: optStr(formData, "notes"),
      active: !optBool(formData, "inactive"),
    };
    const before = id
      ? await prisma.paymentMethodConfig.findUnique({ where: { id } })
      : null;
    const method = id
      ? await prisma.paymentMethodConfig.update({ where: { id }, data })
      : await prisma.paymentMethodConfig.create({
          data: { ...data, createdById: auth.user.id },
        });
    await writeAudit({
      userId: auth.user.id,
      action: id ? "update" : "create",
      entity: "PaymentMethodConfig",
      entityId: method.id,
      before,
      after: data,
      origin: "financeiro/cadastros",
    });
    refresh();
    return { ok: true };
  } catch (error) {
    return {
      error:
        typeof error === "object" && error && "code" in error && error.code === "P2002"
          ? "Já existe uma forma de pagamento com este código."
          : "Não foi possível salvar a forma de pagamento.",
    };
  }
}

export async function saveFinancialProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireFinancePermission("MANAGE_REGISTRIES");
  if ("error" in auth) return auth;
  const id = optStr(formData, "id");
  const code = str(formData, "code").toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  const name = str(formData, "name");
  const type = (optEnum(formData, "type") ?? "SERVICO") as FinancialProductType;
  if (!code || !name) return { error: "Código e nome são obrigatórios." };
  if (!(type in FinancialProductType)) return { error: "Tipo inválido." };
  try {
    const data = {
      code,
      name,
      type,
      notes: optStr(formData, "notes"),
      active: !optBool(formData, "inactive"),
    };
    const before = id
      ? await prisma.financialProduct.findUnique({ where: { id } })
      : null;
    const product = id
      ? await prisma.financialProduct.update({ where: { id }, data })
      : await prisma.financialProduct.create({
          data: { ...data, createdById: auth.user.id },
        });
    await writeAudit({
      userId: auth.user.id,
      action: id ? "update" : "create",
      entity: "FinancialProduct",
      entityId: product.id,
      before,
      after: data,
      origin: "financeiro/cadastros",
    });
    refresh();
    return { ok: true };
  } catch (error) {
    return {
      error:
        typeof error === "object" && error && "code" in error && error.code === "P2002"
          ? "Já existe um produto/serviço com este código."
          : "Não foi possível salvar o produto/serviço.",
    };
  }
}
