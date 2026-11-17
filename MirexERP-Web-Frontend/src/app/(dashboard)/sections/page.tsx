"use client";
import EntityManager, { type EntityConfig } from "@/components/phase2/EntityManager";
const config: EntityConfig = {
  title: "Section Management", singular: "Section", endpoint: "/sections",
  description: "Create sections under a class, set room and capacity, and assign a class teacher.",
  fields: [
    { name: "sessionId", label: "Academic session", type: "select", source: "/sessions", required: true },
    { name: "classId", label: "Class", type: "select", source: "/classes", required: true },
    { name: "name", label: "Section name", required: true, placeholder: "A" }, { name: "code", label: "Section code", required: true, placeholder: "6A" },
    { name: "displayName", label: "Display name" }, { name: "roomNumber", label: "Room number" },
    { name: "capacity", label: "Capacity", type: "number", min: 1 }, { name: "classTeacherId", label: "Class teacher", type: "select", source: "/employees" },
    { name: "description", label: "Description", type: "textarea" },
  ],
  immutableOnUpdate: ["sessionId", "classId"],
  columns: [{ key: "name", label: "Section" }, { key: "code", label: "Code" }, { key: "classId.name", label: "Class" }, { key: "roomNumber", label: "Room" }, { key: "capacity", label: "Capacity" }, { key: "enrolledStudents", label: "Enrolled" }, { key: "availableSeats", label: "Available seats" }, { key: "classTeacherId.fullName", label: "Class teacher" }, { key: "isActive", label: "Active" }],
};
export default function SectionsPage() { return <EntityManager config={config} />; }
