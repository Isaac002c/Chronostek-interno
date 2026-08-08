import { Prisma, ProspectContactType, ProspectStatus, ProspectVerificationStatus, type Prospect } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeCnpj, normalizeCompanyName, normalizeDomain, normalizeEmail, normalizePhone, normalizeSocial } from "./normalize";
import { scoreProspect } from "./score";

export type ProspectInput = {
  companyName: string;
  tradeName?: string;
  cnpj?: string;
  segment?: string;
  cnae?: string;
  companySize?: string;
  city?: string;
  state?: string;
  address?: string;
  website?: string;
  commercialPhone?: string;
  commercialWhatsApp?: string;
  commercialEmail?: string;
  instagram?: string;
  linkedin?: string;
  facebook?: string;
  contactName?: string;
  contactRole?: string;
  contactPhone?: string;
  contactEmail?: string;
  source: string;
  sourceUrl?: string;
  sourceDate?: Date;
  confidence?: number;
  marketingSignals?: string[];
  technologySignals?: string[];
  painPoints?: string[];
};

function publicContacts(input: ProspectInput) {
  return [
    [ProspectContactType.PHONE, input.commercialPhone, normalizePhone(input.commercialPhone)],
    [ProspectContactType.WHATSAPP, input.commercialWhatsApp, normalizePhone(input.commercialWhatsApp)],
    [ProspectContactType.EMAIL, input.commercialEmail, normalizeEmail(input.commercialEmail)],
    [ProspectContactType.INSTAGRAM, input.instagram, normalizeSocial(input.instagram)],
    [ProspectContactType.LINKEDIN, input.linkedin, normalizeSocial(input.linkedin)],
    [ProspectContactType.FACEBOOK, input.facebook, normalizeSocial(input.facebook)],
    [ProspectContactType.WEBSITE, input.website, normalizeDomain(input.website)],
  ] as const;
}

export async function findDuplicateProspect(input: ProspectInput, tenantId = "default"): Promise<Prospect | null> {
  const normalizedName = normalizeCompanyName(input.companyName);
  const cnpj = normalizeCnpj(input.cnpj);
  const websiteDomain = normalizeDomain(input.website);
  const phone = normalizePhone(input.commercialPhone ?? input.commercialWhatsApp);
  const email = normalizeEmail(input.commercialEmail);
  const socials = [input.instagram, input.linkedin, input.facebook].map(normalizeSocial).filter((v): v is string => Boolean(v));
  const or: Prisma.ProspectWhereInput[] = [];
  if (cnpj) or.push({ cnpj });
  if (websiteDomain) or.push({ websiteDomain });
  if (phone) or.push({ OR: [{ commercialPhone: phone }, { commercialWhatsApp: phone }] });
  if (email) or.push({ commercialEmail: email });
  if (socials.length) or.push({ contacts: { some: { normalizedValue: { in: socials } } } });
  if (normalizedName) or.push({ normalizedName, city: input.city || undefined, state: input.state || undefined });
  if (!or.length) return null;
  return prisma.prospect.findFirst({ where: { tenantId, OR: or }, orderBy: { createdAt: "asc" } });
}

export async function saveProspect(input: ProspectInput, tenantId = "default"): Promise<{ prospect: Prospect; created: boolean }> {
  if (!input.companyName.trim()) throw new Error("companyName é obrigatório");
  if (!input.source.trim()) throw new Error("source é obrigatório para garantir proveniência");
  const cnpj = normalizeCnpj(input.cnpj);
  const websiteDomain = normalizeDomain(input.website);
  const commercialPhone = normalizePhone(input.commercialPhone);
  const commercialWhatsApp = normalizePhone(input.commercialWhatsApp);
  const commercialEmail = normalizeEmail(input.commercialEmail);
  const score = scoreProspect(input);
  const existing = await findDuplicateProspect(input, tenantId);
  const confidence = Math.max(0, Math.min(1, input.confidence ?? 0.5));
  const prospect = await prisma.$transaction(async (tx) => {
    const data = {
      tradeName: input.tradeName,
      cnpj,
      segment: input.segment,
      cnae: input.cnae,
      companySize: input.companySize,
      city: input.city,
      state: input.state?.toUpperCase().slice(0, 2),
      address: input.address,
      website: input.website,
      websiteDomain,
      commercialPhone,
      commercialWhatsApp,
      commercialEmail,
      instagram: input.instagram,
      linkedin: input.linkedin,
      facebook: input.facebook,
      contactName: input.contactName,
      contactRole: input.contactRole,
      contactPhone: normalizePhone(input.contactPhone),
      contactEmail: normalizeEmail(input.contactEmail),
      source: input.source,
      sourceUrl: input.sourceUrl,
      sourceDate: input.sourceDate ?? new Date(),
      marketingFitScore: score.marketingFitScore,
      technologyFitScore: score.technologyFitScore,
      overallScore: score.overallScore,
      businessFit: score.businessFit,
      qualification: score.qualification,
      qualificationReason: score.reason,
      painPoints: input.painPoints ?? [],
      digitalSignals: input.marketingSignals ?? [],
      technologySignals: input.technologySignals ?? [],
      status: score.businessFit === "UNQUALIFIED" ? ProspectStatus.DISCOVERED : ProspectStatus.QUALIFIED,
    } satisfies Prisma.ProspectUncheckedUpdateInput;
    const saved = existing
      ? await tx.prospect.update({ where: { id: existing.id }, data })
      : await tx.prospect.create({ data: { tenantId, companyName: input.companyName.trim(), normalizedName: normalizeCompanyName(input.companyName), ...data } });

    const fields: Array<[string, string | undefined | null]> = [
      ["companyName", input.companyName], ["cnpj", cnpj], ["website", input.website],
      ["commercialPhone", commercialPhone], ["commercialWhatsApp", commercialWhatsApp],
      ["commercialEmail", commercialEmail], ["instagram", input.instagram], ["linkedin", input.linkedin],
    ];
    await Promise.all(fields.filter(([, value]) => Boolean(value)).map(([field, value]) => tx.prospectSource.create({
      data: { prospectId: saved.id, field, value: value!, source: input.source, sourceUrl: input.sourceUrl, confidence },
    })));
    for (const [type, raw, normalized] of publicContacts(input)) {
      if (!raw || !normalized) continue;
      await tx.prospectContact.upsert({
        where: { prospectId_type_normalizedValue: { prospectId: saved.id, type, normalizedValue: normalized } },
        update: { source: input.source, sourceUrl: input.sourceUrl, confidence, foundAt: new Date() },
        create: {
          prospectId: saved.id, type, value: raw, normalizedValue: normalized, source: input.source,
          sourceUrl: input.sourceUrl, confidence, verificationStatus: ProspectVerificationStatus.UNVERIFIED,
        },
      });
    }
    return saved;
  });
  return { prospect, created: !existing };
}
