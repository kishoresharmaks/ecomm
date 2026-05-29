import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { IndiHubRequest } from "../types/indihub-request";

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<IndiHubRequest>();
  return request.currentUser;
});
