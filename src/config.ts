import { z } from "zod";
import type { AuditConfig } from "./types.js";

const positiveInt = (defaultValue: number) =>
  z.coerce
    .number()
    .int()
    .positive()
    .default(defaultValue);

const auditOptionsSchema = z.object({
  url: z.string().url(),
  maxPages: positiveInt(25),
  report: z.enum(["terminal", "json", "html"]).default("terminal"),
  checks: z
    .object({
      links: z.boolean().default(true),
      images: z.boolean().default(true),
      accessibility: z.boolean().default(true),
      securityHeaders: z.boolean().default(true),
      consoleErrors: z.boolean().default(true),
      hydrationErrors: z.boolean().default(true),
      metadata: z.boolean().default(true),
      mixedContent: z.boolean().default(true),
    })
    .default({}),
});

export type AuditOptionsInput = z.input<typeof auditOptionsSchema>;

export function buildConfig(input: AuditOptionsInput): AuditConfig {
  return auditOptionsSchema.parse(input);
}

export function formatValidationError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
}
