export const ROLES = ["student", "teacher", "admin", "support"] as const;
export type Role = (typeof ROLES)[number];

/** The authenticated principal every domain call is evaluated against. */
export type Actor = {
  id: string;
  role: Role;
  schoolId: string;
  displayName: string;
};

export const ROLE_LABEL: Record<Role, string> = {
  student: "Student",
  teacher: "Teacher",
  admin: "School administrator",
  support: "Student support staff",
};
