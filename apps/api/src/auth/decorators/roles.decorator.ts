import { SetMetadata } from "@nestjs/common";
import { RoleCode } from "@indihub/database";
import { ROLES_KEY } from "../auth.constants";

export const Roles = (...roles: RoleCode[]) => SetMetadata(ROLES_KEY, roles);
