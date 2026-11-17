"use client";
import EntityManager, { type EntityConfig } from "@/components/phase2/EntityManager";
const config: EntityConfig = {
  title: "Student Management", singular: "Student", endpoint: "/students",
  description: "Maintain student profiles, admission records, class placement and guardian links.",
  fields: [
    { name: "admissionNumber", label: "Admission number", required: true },
    { name: "firstName", label: "First name", required: true }, { name: "middleName", label: "Middle name" },
    { name: "lastName", label: "Last name", required: true }, { name: "dateOfBirth", label: "Date of birth", type: "date", required: true },
    { name: "gender", label: "Gender", type: "select", required: true, options: ["MALE", "FEMALE", "OTHER"].map((v) => ({ label: v, value: v })) },
    { name: "bloodGroup", label: "Blood group", type: "select", options: ["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((v) => ({ label: v, value: v })) },
    { name: "email", label: "Email", type: "email" }, { name: "phone", label: "Phone", type: "tel" },
    { name: "sessionId", label: "Academic session ID", required: true, source: "/sessions", type: "select", help: "Choose the session this student belongs to." },
    { name: "classId", label: "Class ID", required: true, source: "/classes", type: "select" },
    { name: "sectionId", label: "Section ID", required: true, source: "/sections", type: "select" },
    { name: "parentId", label: "Parent / guardian", source: "/parents", type: "select" },
    { name: "rollNumber", label: "Roll number" }, { name: "admissionDate", label: "Admission date", type: "date" },
    { name: "previousSchool", label: "Previous school" },
    { name: "previousSchoolDetails.board", label: "Previous school board" },
    { name: "previousSchoolDetails.previousClass", label: "Previous class" },
    { name: "previousSchoolDetails.academicSession", label: "Previous academic session" },
    { name: "previousSchoolDetails.tcNumber", label: "Previous TC number" },
    { name: "previousSchoolDetails.address", label: "Previous school address" },
    { name: "profileImage", label: "Student photo URL" }, { name: "address.street", label: "Street address" },
    { name: "address.city", label: "City" }, { name: "address.state", label: "State" }, { name: "address.postalCode", label: "PIN code" },
    { name: "emergencyContact.name", label: "Emergency contact name" }, { name: "emergencyContact.relationship", label: "Emergency contact relation" },
    { name: "emergencyContact.phone", label: "Emergency contact phone", type: "tel" },
    { name: "medicalInformation.notes", label: "Medical notes", type: "textarea" },
  ],
  immutableOnUpdate: ["admissionNumber", "sessionId", "classId", "sectionId"],
  downloadSuffix: "/id-card", detailLink: true,
  columns: [{ key: "admissionNumber", label: "Admission No." }, { key: "firstName", label: "First name" }, { key: "lastName", label: "Last name" }, { key: "classId.name", label: "Class" }, { key: "sectionId.name", label: "Section" }, { key: "status", label: "Status" }],
};
export default function StudentsPage() { return <><div className="flex justify-end px-5 pt-4"><a href="/students/reports" className="rounded-lg border px-3 py-2 text-sm">Student Reports</a></div><EntityManager config={config} /></>; }
