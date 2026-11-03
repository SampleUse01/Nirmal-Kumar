import colors from "colors";
import mongoose from "mongoose";
import { env } from "./env.js";

mongoose.connection.on("connected", () => {
  console.log(colors.green("MongoDB connected successfully."));
});

mongoose.connection.on("disconnected", () => {
  console.warn(colors.yellow("MongoDB connection was lost; waiting for reconnection."));
});

mongoose.connection.on("reconnected", () => {
  console.log(colors.green("MongoDB connection restored."));
});

function getConnectionHint(error: unknown): string {
  const failure = error as { code?: string | number; message?: string };
  const message = failure?.message?.toLowerCase() ?? "";

  if (failure?.code === 8000 || /bad auth|authentication failed/.test(message)) {
    return [
      "MongoDB authentication failed.",
      "Check the Atlas Database Access username/password and URL-encode special characters.",
      "For Atlas database users, verify authSource=admin.",
      "The connection URI and credentials were not logged."
    ].join("\n");
  }

  if (/enotfound|eai_again/.test(message)) {
    return "MongoDB host could not be resolved. Check the cluster hostname and DNS/network access.";
  }

  if (/etimedout|server selection timed out|timed out/.test(message)) {
    return "MongoDB connection timed out. Check Atlas Network Access/IP allowlist and network availability.";
  }

  return "MongoDB connection failed. Check MONGODB_URI, Atlas Database Access, Network Access, and network availability. The URI was not logged.";
}

export async function connectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;

  console.log(colors.cyan("Connecting to MongoDB..."));
  try {
    await mongoose.connect(env.MONGODB_URI);
  } catch (error) {
    console.error(colors.red(getConnectionHint(error)));
    throw new Error("MongoDB connection failed; see the diagnostic above.");
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
  console.log(colors.gray("MongoDB connection closed."));
}
