import { randomBytes } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const envPath = fileURLToPath(new URL("../../.env", import.meta.url));
const rotate = process.argv.includes("--rotate");
const placeholders = /^(?:|.*(?:replace|change.?me|your[-_ ]|example).*)$/i;

let contents: string;
try {
  contents = await readFile(envPath, "utf8");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === "ENOENT") {
    throw new Error("apps/api/.env was not found. Copy .env.example to .env first.");
  }
  throw error;
}

function readValue(key: string) {
  const line = contents.split(/\r?\n/).find((entry) => entry.trimStart().startsWith(`${key}=`));
  return line?.slice(line.indexOf("=") + 1).trim().replace(/^(['"])(.*)\1$/, "$2") ?? "";
}

const accessSecret = readValue("JWT_ACCESS_SECRET");
const refreshSecret = readValue("JWT_REFRESH_SECRET");
const accessNeedsUpdate = rotate || accessSecret.length < 32 || placeholders.test(accessSecret);
const refreshNeedsUpdate = rotate || refreshSecret.length < 32 || placeholders.test(refreshSecret);

if (!accessNeedsUpdate && !refreshNeedsUpdate && accessSecret === refreshSecret) {
  throw new Error("Access and refresh secrets are identical. Run again with --rotate to replace both.");
}

const replacements = new Map<string, string>();
if (accessNeedsUpdate) replacements.set("JWT_ACCESS_SECRET", randomBytes(48).toString("base64url"));
if (refreshNeedsUpdate) replacements.set("JWT_REFRESH_SECRET", randomBytes(48).toString("base64url"));

if (
  replacements.has("JWT_ACCESS_SECRET") &&
  replacements.get("JWT_ACCESS_SECRET") === refreshSecret
) {
  replacements.set("JWT_ACCESS_SECRET", randomBytes(48).toString("base64url"));
}
if (
  replacements.has("JWT_REFRESH_SECRET") &&
  replacements.get("JWT_REFRESH_SECRET") === accessSecret
) {
  replacements.set("JWT_REFRESH_SECRET", randomBytes(48).toString("base64url"));
}

let updated = contents;
for (const [key, value] of replacements) {
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(updated)) {
    updated = updated.replace(pattern, `${key}=${value}`);
  } else {
    updated = `${updated.replace(/\s*$/, "")}\n${key}=${value}\n`;
  }
}

const tempPath = `${envPath}.tmp`;
await writeFile(tempPath, updated, { encoding: "utf8", flag: "wx" });
try {
  await rename(tempPath, envPath);
} catch (error) {
  const { unlink } = await import("node:fs/promises");
  await unlink(tempPath);
  throw error;
}

console.log(`Generated ${replacements.size} JWT secret(s) in apps/api/.env; secret values were not printed.`);
if (rotate) console.log("Rotation invalidates all JWTs signed with the previous secrets.");
