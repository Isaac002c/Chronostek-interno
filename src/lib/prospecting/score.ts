import { ProspectBusinessFit, ProspectQualification } from "@prisma/client";

export type ProspectScoreInput = {
  website?: string | null;
  commercialPhone?: string | null;
  commercialWhatsApp?: string | null;
  commercialEmail?: string | null;
  instagram?: string | null;
  linkedin?: string | null;
  segment?: string | null;
  marketingSignals?: string[];
  technologySignals?: string[];
  painPoints?: string[];
};

export type ProspectScore = {
  marketingFitScore: number;
  technologyFitScore: number;
  overallScore: number;
  businessFit: ProspectBusinessFit;
  qualification: ProspectQualification;
  reason: string;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function scoreProspect(input: ProspectScoreInput): ProspectScore {
  const contactability = [input.commercialPhone, input.commercialWhatsApp, input.commercialEmail].filter(Boolean).length;
  const socialPresence = [input.instagram, input.linkedin].filter(Boolean).length;
  const marketingSignals = input.marketingSignals?.length ?? 0;
  const technologySignals = input.technologySignals?.length ?? 0;
  const painPoints = input.painPoints?.length ?? 0;

  const marketingFitScore = clamp(
    18 + (input.segment ? 8 : 0) + contactability * 6 + (input.website ? 4 : 10) + marketingSignals * 16 +
      (socialPresence === 0 ? 14 : socialPresence === 1 ? 8 : 2) + Math.min(12, painPoints * 4),
  );
  const technologyFitScore = clamp(
    18 + (input.segment ? 8 : 0) + contactability * 6 + technologySignals * 18 +
      (input.website ? 2 : 8) + Math.min(12, painPoints * 4),
  );
  const highMarketing = marketingFitScore >= 65;
  const highTechnology = technologyFitScore >= 65;
  const businessFit = highMarketing && highTechnology
    ? ProspectBusinessFit.BOTH
    : highMarketing
      ? ProspectBusinessFit.TELUN_M_PLUS
      : highTechnology
        ? ProspectBusinessFit.TELUN_TECHNOLOGY
        : ProspectBusinessFit.UNQUALIFIED;
  const overallScore = clamp((marketingFitScore + technologyFitScore) / 2 + Math.min(10, contactability * 3));
  const qualification = overallScore >= 80
    ? ProspectQualification.A
    : overallScore >= 65
      ? ProspectQualification.B
      : overallScore >= 45
        ? ProspectQualification.C
        : overallScore >= 25
          ? ProspectQualification.D
          : ProspectQualification.UNQUALIFIED;
  return {
    marketingFitScore,
    technologyFitScore,
    overallScore,
    businessFit,
    qualification,
    reason: `Score determinístico: contato ${contactability}/3, sinais de marketing ${marketingSignals}, sinais de tecnologia ${technologySignals}.`,
  };
}
