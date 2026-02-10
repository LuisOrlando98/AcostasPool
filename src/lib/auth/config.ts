export const AUTH_COOKIE_NAME = "ap_session";
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export const ROLE_REDIRECTS: Record<UserRole, string> = {
  ADMIN: "/admin",
  TECH: "/tech",
  CUSTOMER: "/client",
};

export type UserRole = "ADMIN" | "TECH" | "CUSTOMER";
