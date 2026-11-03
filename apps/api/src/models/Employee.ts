import { Schema, model } from "mongoose";

const employeeSchema = new Schema(
  {
    employeeId: { type: String, required: true, unique: true, trim: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, maxlength: 30, default: "" },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    designation: { type: String, trim: true, maxlength: 100, default: "" },
    managerId: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
    joiningDate: { type: Date, default: null },
    address: { type: String, trim: true, maxlength: 500, default: "" },
    active: { type: Boolean, default: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

employeeSchema.index({ name: "text", employeeId: "text", email: "text" });
employeeSchema.index({ departmentId: 1, active: 1 });

export const Employee = model("Employee", employeeSchema);
