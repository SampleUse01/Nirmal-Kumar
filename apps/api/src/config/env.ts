import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1),
  WEB_ORIGIN: z
    .string()
    .transform((value) => value.split(",").map((origin) => origin.trim()).filter(Boolean))
    .pipe(z.array(z.string().url().transform((value) => new URL(value).origin)).min(1)),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(7),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().optional(),
  DEMO_ADMIN_EMAIL: z.string().email().optional(),
  DEMO_ADMIN_PASSWORD: z.string().optional(),
  DEMO_EMPLOYEE_EMAIL: z.string().email().optional(),
  DEMO_EMPLOYEE_PASSWORD: z.string().optional()
}).superRefine((config, context) => {
  if (config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET) {
    context.addIssue({
      code: "custom",
      path: ["JWT_REFRESH_SECRET"],
      message: "Access and refresh token secrets must be different."
    });
  }
});

const result = schema.safeParse(process.env);

if (!result.success) {
  console.error("Invalid environment configuration:", result.error.flatten().fieldErrors);
  throw new Error("The API cannot start until its environment variables are corrected.");
}

export const env = result.data;
