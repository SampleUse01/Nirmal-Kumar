import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_KEYS } from "./permissions.js";

test("Super Admin receives the complete permission catalog", () => {
  assert.deepEqual(DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN, PERMISSION_KEYS);
});

test("default Employee permissions do not grant administrative management", () => {
  assert.equal(DEFAULT_ROLE_PERMISSIONS.EMPLOYEE.includes("EMPLOYEES_MANAGE"), false);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.EMPLOYEE.includes("DEPARTMENTS_MANAGE"), false);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.EMPLOYEE.includes("WORK_REQUESTS_REVIEW"), false);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.EMPLOYEE.includes("ROLE_MANAGE"), false);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.EMPLOYEE.includes("ADMIN_MANAGE"), false);
});
