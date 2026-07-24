"use server";

import { DreRowKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  optBool,
  optDate,
  optEnum,
  optInt,
  optStr,
  requireFinancePermission,
  str,
  type ActionState,
} from "@/lib/actions";
import {
  archiveDreModel,
  createDefaultDreModel,
  createDreVersion,
  publishDreVersion,
  replaceDreRowMappings,
  saveDreRow,
  setDefaultDreModel,
} from "@/lib/finance-dre-models";

function revalidateDre(modelId?: string) {
  revalidatePath("/dashboard/financeiro/dre");
  revalidatePath("/dashboard/financeiro/dre/modelos");
  if (modelId) revalidatePath(`/dashboard/financeiro/dre/modelos/${modelId}`);
}

export async function createDreModelAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireFinancePermission("CONFIGURE_DRE");
  if ("error" in auth) return auth;
  let modelId: string;
  try {
    const model = await createDefaultDreModel({
      name: str(formData, "name"),
      description: optStr(formData, "description"),
      userId: auth.user.id,
    });
    modelId = model.id;
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Não foi possível criar o modelo.",
    };
  }
  revalidateDre();
  redirect(`/dashboard/financeiro/dre/modelos/${modelId}`);
}

export async function createDreVersionAction(
  modelId: string,
): Promise<ActionState> {
  const auth = await requireFinancePermission("CONFIGURE_DRE");
  if ("error" in auth) return auth;
  try {
    await createDreVersion(modelId, auth.user.id);
    revalidateDre(modelId);
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Falha ao versionar." };
  }
}

export async function saveDreRowAction(
  modelId: string,
  versionId: string,
  rowId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireFinancePermission("CONFIGURE_DRE");
  if ("error" in auth) return auth;
  const kind = (optEnum(formData, "kind") ?? "CONTA") as DreRowKind;
  if (!(kind in DreRowKind)) return { error: "Tipo de linha inválido." };
  let formula: unknown;
  if (kind === "FORMULA" || kind === "SUBTOTAL") {
    try {
      formula = JSON.parse(str(formData, "formula"));
    } catch {
      return { error: "A fórmula deve ser um JSON válido da estrutura segura." };
    }
  }
  try {
    await saveDreRow({
      versionId,
      rowId,
      parentId: optStr(formData, "parentId"),
      code: str(formData, "code"),
      name: str(formData, "name"),
      kind,
      order: optInt(formData, "order") ?? 0,
      sign: optInt(formData, "sign") ?? 1,
      hidden: optBool(formData, "hidden"),
      formula,
      userId: auth.user.id,
    });
    revalidateDre(modelId);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Falha ao salvar a linha.",
    };
  }
}

export async function saveDreMappingsAction(
  modelId: string,
  rowId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireFinancePermission("CONFIGURE_DRE");
  if ("error" in auth) return auth;
  try {
    await replaceDreRowMappings({
      rowId,
      categoryIds: formData.getAll("categoryIds").map(String),
      costCenterIds: formData.getAll("costCenterIds").map(String),
      userId: auth.user.id,
    });
    revalidateDre(modelId);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Falha ao salvar vínculos.",
    };
  }
}

export async function publishDreVersionAction(
  modelId: string,
  versionId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireFinancePermission("PUBLISH_DRE");
  if ("error" in auth) return auth;
  const effectiveFrom = optDate(formData, "effectiveFrom");
  if (!effectiveFrom) return { error: "Informe a data inicial da versão." };
  try {
    await publishDreVersion({
      versionId,
      effectiveFrom,
      userId: auth.user.id,
      notes: optStr(formData, "notes"),
    });
    revalidateDre(modelId);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Falha ao publicar a versão.",
    };
  }
}

export async function setDefaultDreModelAction(
  modelId: string,
): Promise<ActionState> {
  const auth = await requireFinancePermission("PUBLISH_DRE");
  if ("error" in auth) return auth;
  try {
    await setDefaultDreModel(modelId, auth.user.id);
    revalidateDre(modelId);
    return { ok: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Falha ao definir padrão.",
    };
  }
}

export async function archiveDreModelAction(
  modelId: string,
  formData: FormData,
): Promise<void> {
  const auth = await requireFinancePermission("PUBLISH_DRE");
  if ("error" in auth) return;
  await archiveDreModel(
    modelId,
    auth.user.id,
    str(formData, "reason") || "Arquivamento confirmado",
  );
  revalidateDre(modelId);
  redirect("/dashboard/financeiro/dre/modelos");
}
