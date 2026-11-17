import test from "node:test";
import assert from "node:assert/strict";
import { createStudentSchema, updateStudentSchema } from "../src/modules/students/students.validation";
import { createParentSchema } from "../src/modules/parents/parents.validation";
import { createClassSchema } from "../src/modules/classes/classes.validation";
import { createSectionSchema } from "../src/modules/sections/sections.validation";
import { createSubjectSchema } from "../src/modules/subjects/subjects.validation";
import { createEmployeeSchema } from "../src/modules/employees/employees.validation";
import { createAdmissionFollowUpSchema } from "../src/modules/admissions/admissions.validation";

const id = "64b000000000000000000001";

test("student creation requires valid school academic placement IDs", () => {
  const result = createStudentSchema.safeParse({ body: {
    admissionNumber: "ADM-001", firstName: "Aarav", lastName: "Sharma",
    dateOfBirth: "2015-02-01", gender: "MALE", sessionId: id, classId: id, sectionId: id,
  } });
  assert.equal(result.success, true);
});

test("student update rejects immutable admission number", () => {
  const result = updateStudentSchema.safeParse({ params: { id }, body: { admissionNumber: "NEW-001" } });
  assert.equal(result.success, false);
});

test("parent can be created without an email when guardian has phone contact", () => {
  const result = createParentSchema.safeParse({ firstName: "Asha", lastName: "Sharma", phone: "9876543210", relation: "MOTHER", studentIds: [id] });
  assert.equal(result.success, true);
});

test("class requires a session and a valid numeric level", () => {
  const valid = createClassSchema.safeParse({ sessionId: id, name: "Class 5", code: "C5", numericLevel: 5 });
  const invalid = createClassSchema.safeParse({ sessionId: id, name: "Class 5", code: "C5", numericLevel: 0 });
  assert.equal(valid.success, true);
  assert.equal(invalid.success, false);
});

test("section requires class and session associations", () => {
  const result = createSectionSchema.safeParse({ sessionId: id, classId: id, name: "A", code: "5A" });
  assert.equal(result.success, true);
});

test("subject code is normalized to uppercase", () => {
  const result = createSubjectSchema.safeParse({ name: "Mathematics", code: "math", subjectType: "CORE" });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.code, "MATH");
});

test("employee requires a valid phone, employee type and designation", () => {
  const result = createEmployeeSchema.safeParse({ employeeId: "emp-01", firstName: "Riya", lastName: "Verma", phone: "9876543210", gender: "FEMALE", employeeType: "TEACHING", designation: "Teacher", joiningDate: "2026-04-01" });
  assert.equal(result.success, true);
});

test("admission follow-up requires a useful note and valid date ordering", () => {
  const valid = createAdmissionFollowUpSchema.safeParse({ note: "Called guardian", followUpDate: "2026-11-12", nextFollowUpDate: "2026-11-15" });
  const invalid = createAdmissionFollowUpSchema.safeParse({ note: "OK", followUpDate: "2026-11-15", nextFollowUpDate: "2026-11-12" });
  assert.equal(valid.success, true);
  assert.equal(invalid.success, false);
});
