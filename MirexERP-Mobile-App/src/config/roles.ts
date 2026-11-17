import { UserRole } from "@/types/auth";
export const roleLabels: Record<UserRole, string> = {
  PARENT: "Parent", TEACHER: "Teacher", STUDENT: "Student"
};
export const roleHome: Record<UserRole, string> = {
  PARENT: "/(tabs)", TEACHER: "/(tabs)", STUDENT: "/(tabs)"
};
