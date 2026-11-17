import test from "node:test";
import assert from "node:assert/strict";
import {
  createHomeworkSchema, updateHomeworkSchema, submitHomeworkSchema,
  evaluateSubmissionSchema,
} from "../src/modules/homework/homework.validation";

const id = "64b000000000000000000001";

test("homework creation validates school session/class/subject and due date", () => {
  const valid = createHomeworkSchema.safeParse({ body: {
    academicSessionId: id, classId: id, subjectId: id, title: "Chapter 1",
    description: "Complete the questions", dueDate: "2026-11-20",
    allowSubmission: "true", allowLateSubmission: "false", allowResubmission: "true",
  } });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.body.allowSubmission, true);
    assert.equal(valid.data.body.allowLateSubmission, false);
    assert.equal(valid.data.body.allowResubmission, true);
  }
});

test("homework creation rejects invalid IDs, missing due date and unsafe external attachment URLs", () => {
  assert.equal(createHomeworkSchema.safeParse({ body: {
    academicSessionId: "bad", classId: id, subjectId: id, title: "Test",
    description: "Instructions", dueDate: "2026-11-20",
  } }).success, false);
  assert.equal(createHomeworkSchema.safeParse({ body: {
    academicSessionId: id, classId: id, subjectId: id, title: "Test",
    description: "Instructions",
  } }).success, false);
  assert.equal(createHomeworkSchema.safeParse({ body: {
    academicSessionId: id, classId: id, subjectId: id, title: "Test",
    description: "Instructions", dueDate: "2026-11-20",
    attachments: [{ name: "x.pdf", url: "https://untrusted.example/x.pdf" }],
  } }).success, false);
});

test("homework updates reject empty payloads and accept partial changes", () => {
  assert.equal(updateHomeworkSchema.safeParse({ params: { id }, body: {} }).success, false);
  assert.equal(updateHomeworkSchema.safeParse({ params: { id }, body: { allowLateSubmission: "true" } }).success, true);
});

test("student submission requires a valid homework ID", () => {
  assert.equal(submitHomeworkSchema.safeParse({ params: { id }, body: { answer: "Answer" } }).success, true);
  assert.equal(submitHomeworkSchema.safeParse({ params: { id: "bad" }, body: { answer: "Answer" } }).success, false);
});

test("evaluation rejects negative marks and accepts a resubmission request", () => {
  assert.equal(evaluateSubmissionSchema.safeParse({ params: { id, submissionId: id }, body: { marksObtained: -1 } }).success, false);
  assert.equal(evaluateSubmissionSchema.safeParse({ params: { id, submissionId: id }, body: { requestResubmission: true } }).success, true);
});
