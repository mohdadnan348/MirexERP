export type UserRole = "PARENT" | "TEACHER" | "STUDENT";
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  schoolId: string;
  avatarUrl?: string;
}
export interface LoginResult { accessToken: string; refreshToken?: string; user: User; }
