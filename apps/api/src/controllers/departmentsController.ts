import type { RequestHandler } from "express";
import { z } from "zod";
import { Department } from "../models/Department.js";
import { getDateRange, toCsv } from "../utils/dateFilters.js";

const departmentSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional()
});
const departmentUpdateSchema = departmentSchema.partial().extend({ active: z.boolean().optional() });

export const listDepartments: RequestHandler = async (_request, response) => {
  const departments = await Department.find(getDepartmentFilter(_request)).sort({ name: 1 });
  response.json({ departments });
};

function getDepartmentFilter(request: Parameters<RequestHandler>[0]) {
  const filter: Record<string, unknown> = {};
  if (typeof request.query.search === "string" && request.query.search.trim()) {
    const escaped = request.query.search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { description: { $regex: escaped, $options: "i" } }
    ];
  }
  if (request.query.active === "true") filter.active = true;
  if (request.query.active === "false") filter.active = false;
  const createdAt = getDateRange(request.query);
  if (createdAt) filter.createdAt = createdAt;
  return filter;
}

export const exportDepartments: RequestHandler = async (request, response) => {
  const departments = await Department.find(getDepartmentFilter(request)).sort({ name: 1 });
  response.type("text/csv").attachment("departments.csv").send(toCsv(
    ["name", "description", "active", "createdAt"],
    departments.map((department) => [department.name, department.description, department.active, department.createdAt])
  ));
};

export const importDepartments: RequestHandler = async (request, response) => {
  const { rows } = z.object({
    rows: z.array(z.object({
      name: z.string().max(200).optional(),
      description: z.string().max(500).optional()
    }).passthrough()).max(1000)
  }).parse(request.body);
  const seenNames = new Set<string>();
  const results: Array<{ row: number; status: "imported" | "failed"; name: string; errors: string[] }> = [];
  for (const [index, row] of rows.entries()) {
    const name = row.name?.trim() ?? "";
    const errors: string[] = [];
    if (!name) errors.push("Department name is required.");
    const key = name.toLowerCase();
    if (seenNames.has(key)) errors.push("Duplicate department name in this file.");
    seenNames.add(key);
    if (name && await Department.exists({ name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } })) {
      errors.push("Department already exists.");
    }
    if (errors.length) {
      results.push({ row: index + 2, status: "failed", name, errors });
      continue;
    }
    try {
      await Department.create({ name, description: row.description?.trim() ?? "" });
      results.push({ row: index + 2, status: "imported", name, errors: [] });
    } catch (error) {
      results.push({
        row: index + 2,
        status: "failed",
        name,
        errors: [error instanceof Error && error.name === "ValidationError" ? error.message : "Could not create department."]
      });
    }
  }
  response.status(200).json({
    results,
    imported: results.filter((item) => item.status === "imported").length,
    failed: results.filter((item) => item.status === "failed").length
  });
};

export const createDepartment: RequestHandler = async (request, response) => {
  const department = await Department.create(departmentSchema.parse(request.body));
  response.status(201).json({ department });
};

export const updateDepartment: RequestHandler = async (request, response) => {
  const department = await Department.findByIdAndUpdate(
    request.params.id,
    departmentUpdateSchema.parse(request.body),
    { new: true, runValidators: true }
  );
  if (!department) {
    response.status(404).json({ message: "Department not found." });
    return;
  }
  response.json({ department });
};

export const deactivateDepartment: RequestHandler = async (request, response) => {
  const department = await Department.findByIdAndUpdate(
    request.params.id,
    { active: false },
    { new: true }
  );
  if (!department) {
    response.status(404).json({ message: "Department not found." });
    return;
  }
  response.json({ department });
};
