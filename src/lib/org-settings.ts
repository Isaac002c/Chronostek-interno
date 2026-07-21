import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { BRAND } from "@/lib/brand";

export type OrgSettings = {
  id: string | null;
  brandName: string;
  legalName: string;
  tradeName: string;
  cnpj: string;
  email: string;
  phone: string;
  address: string;
};

/**
 * Configuração da organização (singleton). Marca exibida é sempre Telun;
 * razão social / nome fantasia vêm daqui (ou dos defaults da marca).
 * `cache()` evita reconsultar dentro do mesmo request.
 */
export const getOrgSettings = cache(async (): Promise<OrgSettings> => {
  const row = await prisma.organizationSettings.findFirst().catch(() => null);
  return {
    id: row?.id ?? null,
    brandName: row?.brandName || BRAND.name,
    legalName: row?.legalName || BRAND.legalName,
    tradeName: row?.tradeName || BRAND.tradeName,
    cnpj: row?.cnpj ?? "",
    email: row?.email ?? "",
    phone: row?.phone ?? "",
    address: row?.address ?? "",
  };
});
