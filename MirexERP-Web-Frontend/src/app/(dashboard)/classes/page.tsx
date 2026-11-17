"use client";
import EntityManager, { type EntityConfig } from "@/components/phase2/EntityManager";
const config: EntityConfig = {
  title: "Classes & Sections", singular: "Class", endpoint: "/classes",
  description: "Configure session-wise classes, capacity, class teachers and subject assignments.",
  fields: [
    { name: "sessionId", label: "Academic session", type: "select", source: "/sessions", required: true },
    { name: "name", label: "Class name", required: true, placeholder: "Class 6" }, { name: "code", label: "Class code", required: true, placeholder: "CLS06" },
    { name: "numericLevel", label: "Numeric level", type: "number", min: 1, required: true }, { name: "displayName", label: "Display name" },
    { name: "capacity", label: "Default capacity", type: "number", min: 1 }, { name: "stream", label: "Stream" },
    { name: "classTeacherId", label: "Class teacher", type: "select", source: "/employees" },
    { name: "subjects", label: "Subject IDs", placeholder: "Paste subject IDs separated by commas", help: "Optional; assign existing subject IDs for this class." },
    { name: "description", label: "Description", type: "textarea" },
  ],
  immutableOnUpdate: ["sessionId"],
  columns: [{ key: "name", label: "Class" }, { key: "code", label: "Code" }, { key: "numericLevel", label: "Level" }, { key: "sessionId.name", label: "Session" }, { key: "capacity", label: "Capacity" }, { key: "totalSections", label: "Sections" }, { key: "totalStudents", label: "Students" }, { key: "isActive", label: "Active" }],
};
export default function ClassesPage() { return <EntityManager config={config} />; }
