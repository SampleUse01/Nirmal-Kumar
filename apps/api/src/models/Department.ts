import { Schema, model } from "mongoose";

const departmentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Department = model("Department", departmentSchema);
