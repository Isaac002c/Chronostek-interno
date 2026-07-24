import {
  CalendarEventStatus,
  CalendarEventType,
  CalendarParticipantKind,
  CalendarPriority,
  CalendarPrivacy,
  CalendarRecurrenceEndType,
  CalendarRecurrenceFrequency,
  CalendarReminderUnit,
  EventParticipantStatus,
} from "@prisma/client";
import { z } from "zod";

const nullableId = z.string().trim().min(1).nullable().optional();

export const calendarParticipantSchema = z.object({
  userId: nullableId,
  clientId: nullableId,
  supplierId: nullableId,
  name: z.string().trim().max(180).nullable().optional(),
  email: z.string().trim().email().max(254).nullable().optional(),
  kind: z.nativeEnum(CalendarParticipantKind).default("INTERNO"),
  role: z.string().trim().min(1).max(80).default("PARTICIPANTE"),
  status: z.nativeEnum(EventParticipantStatus).default("CONVIDADO"),
});

export const calendarReminderSchema = z
  .object({
    amount: z.number().int().min(0).max(525_600),
    unit: z.nativeEnum(CalendarReminderUnit).default("MINUTOS"),
  })
  .transform((value) => {
    const multiplier = {
      MINUTOS: 1,
      HORAS: 60,
      DIAS: 1_440,
      SEMANAS: 10_080,
    }[value.unit];
    return { ...value, minutesBefore: value.amount * multiplier };
  })
  .refine((value) => value.minutesBefore <= 525_600, {
    message: "O lembrete deve ocorrer no máximo um ano antes.",
  });

export const calendarRecurrenceSchema = z
  .object({
    frequency: z.nativeEnum(CalendarRecurrenceFrequency),
    interval: z.number().int().min(1).max(365).default(1),
    rrule: z.string().trim().max(1_000).nullable().optional(),
    timezone: z.string().trim().min(1).max(100).default("America/Sao_Paulo"),
    weekDays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
    monthDay: z.number().int().min(1).max(31).nullable().optional(),
    endType: z.nativeEnum(CalendarRecurrenceEndType).default("NUNCA"),
    until: z.coerce.date().nullable().optional(),
    count: z.number().int().min(1).max(500).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.endType === "EM_DATA" && !value.until) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["until"],
        message: "Informe a data final da recorrência.",
      });
    }
    if (value.endType === "APOS_OCORRENCIAS" && !value.count) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["count"],
        message: "Informe o número de ocorrências.",
      });
    }
  });

const calendarEventCreateBaseSchema = z.object({
    title: z.string().trim().min(1).max(240),
    description: z.string().trim().max(10_000).nullable().optional(),
    type: z.nativeEnum(CalendarEventType).default("REUNIAO"),
    status: z.nativeEnum(CalendarEventStatus).default("AGENDADO"),
    priority: z.nativeEnum(CalendarPriority).default("MEDIA"),
    privacy: z.nativeEnum(CalendarPrivacy).default("INTERNO"),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    allDay: z.boolean().default(false),
    timezone: z.string().trim().min(1).max(100).default("America/Sao_Paulo"),
    location: z.string().trim().max(500).nullable().optional(),
    meetingUrl: z.string().trim().url().max(2_000).nullable().optional(),
    category: z.string().trim().max(120).nullable().optional(),
    color: z
      .string()
      .trim()
      .regex(/^#[0-9a-f]{6}$/i)
      .nullable()
      .optional(),
    department: z.string().trim().max(120).nullable().optional(),
    notes: z.string().trim().max(10_000).nullable().optional(),
    costCenterId: nullableId,
    goalId: nullableId,
    planningPeriodId: nullableId,
    clientId: nullableId,
    supplierId: nullableId,
    projectId: nullableId,
    responsibleId: nullableId,
    participants: z.array(calendarParticipantSchema).max(250).default([]),
    reminders: z.array(calendarReminderSchema).max(10).default([]),
    recurrence: calendarRecurrenceSchema.nullable().optional(),
    createGoogleMeet: z.boolean().default(false),
    syncToGoogle: z.boolean().default(false),
  });

export const calendarEventCreateSchema =
  calendarEventCreateBaseSchema.superRefine((value, ctx) => {
    if (value.endAt <= value.startAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endAt"],
        message: "O término deve ocorrer depois do início.",
      });
    }
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: value.timezone }).format(
        value.startAt,
      );
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["timezone"],
        message: "Fuso horário inválido.",
      });
    }
  });

export const calendarEventUpdateSchema = calendarEventCreateBaseSchema
  .omit({
    recurrence: true,
    createGoogleMeet: true,
    syncToGoogle: true,
  })
  .partial()
  .extend({
    createGoogleMeet: z.boolean().optional(),
    syncToGoogle: z.boolean().optional(),
  });

export type CalendarEventCreateInput = z.infer<
  typeof calendarEventCreateSchema
>;
export type CalendarRecurrenceInput = z.infer<
  typeof calendarRecurrenceSchema
>;
