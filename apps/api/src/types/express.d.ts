import type { Role } from "../models/User.js";

declare global {
  namespace Express {
    interface Request {
      authUser?: { id: string; role: Role; mustChangePassword: boolean };
    }
  }
}

export {};
