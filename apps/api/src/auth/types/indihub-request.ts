import { RoleCode } from "@indihub/database";

export type RequestUser = {
  id: string;
  clerkUserId: string | null;
  email: string;
  roles: RoleCode[];
  permissions?: string[];
  authProvider?: "ADMIN_SESSION" | "CLERK" | "DEV";
  impersonatedBy?: {
    id: string;
    email: string;
  };
};

export type IndiHubRequest = {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  currentUser?: RequestUser;
};
