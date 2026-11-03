import bcrypt from "bcryptjs";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { User } from "../models/User.js";

if (!env.BOOTSTRAP_ADMIN_EMAIL || !env.BOOTSTRAP_ADMIN_PASSWORD) {
  throw new Error("Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD before seeding.");
}
if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,128}$/.test(env.BOOTSTRAP_ADMIN_PASSWORD)) {
  throw new Error("The bootstrap password must have 8-128 characters, uppercase, lowercase, a number, and a special character.");
}

await connectDatabase();
try {
  const email = env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
  const exists = await User.exists({ email });
  if (exists) throw new Error("A user with the bootstrap email already exists.");
  const passwordHash = await bcrypt.hash(env.BOOTSTRAP_ADMIN_PASSWORD, 12);
  await User.create({ email, passwordHash, role: "SUPER_ADMIN" });
  console.log(`Created the initial super-admin account for ${email}.`);
} finally {
  await disconnectDatabase();
}
