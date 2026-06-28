import { Inject } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { AdminAuthService } from "../auth/admin-auth.service";
import { ClerkAuthService } from "../auth/clerk-auth.service";
import type { RequestUser } from "../auth/types/indihub-request";
import { RoleCode, UserStatus } from "@indihub/database";
import { PrismaService } from "../prisma/prisma.service";
import { B2BService } from "./b2b.service";

type B2BSocket = Socket & { data: { user?: RequestUser } };

@WebSocketGateway({
  namespace: "/b2b",
  cors: { origin: true, credentials: true },
})
export class B2BGateway implements OnGatewayConnection, OnGatewayInit {
  @WebSocketServer()
  private server!: Server;

  constructor(
    @Inject(B2BService) private readonly b2bService: B2BService,
    @Inject(AdminAuthService) private readonly adminAuthService: AdminAuthService,
    @Inject(ClerkAuthService) private readonly clerkAuthService: ClerkAuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    this.server = server;
    this.b2bService.setBroadcaster((event) => {
      this.server.to(roomName(event.enquiryId)).emit(`b2b.enquiry.${event.type.toLowerCase()}`, event);
    });
  }

  async handleConnection(client: B2BSocket) {
    try {
      client.data.user = await this.resolveUser(client);
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage("b2b.enquiry.join")
  async joinEnquiry(
    @ConnectedSocket() client: B2BSocket,
    @MessageBody() body: { enquiryId?: string },
  ) {
    const actor = client.data.user;
    const enquiryId = body.enquiryId;
    if (!actor || !enquiryId) {
      client.emit("b2b.enquiry.error", { message: "Socket auth and enquiryId are required." });
      return { ok: false };
    }

    const allowed = await this.b2bService.canAccessEnquiryRoom(actor, enquiryId);
    if (!allowed) {
      client.emit("b2b.enquiry.error", { message: "You do not have access to this enquiry." });
      return { ok: false };
    }

    await client.join(roomName(enquiryId));
    return { ok: true };
  }

  @SubscribeMessage("b2b.enquiry.leave")
  async leaveEnquiry(
    @ConnectedSocket() client: B2BSocket,
    @MessageBody() body: { enquiryId?: string },
  ) {
    if (body.enquiryId) {
      await client.leave(roomName(body.enquiryId));
    }
    return { ok: true };
  }

  private async resolveUser(client: Socket): Promise<RequestUser> {
    const auth = client.handshake.auth as Record<string, string | undefined>;
    const token = auth.token ?? auth.clerkToken;
    const adminUser = await this.adminAuthService.resolveAuthorizationHeader(
      token ? `Bearer ${token}` : undefined,
    );
    if (adminUser) {
      return adminUser;
    }

    const allowDevAuth = this.allowDevAuth();
    const clerkUserId = token
      ? await this.clerkAuthService.verifyAuthorizationHeader(`Bearer ${token}`)
      : allowDevAuth
        ? auth.clerkUserId
        : undefined;
    const platformUserId = allowDevAuth ? auth.platformUserId : undefined;
    if (!clerkUserId && !platformUserId) {
      throw new Error("Socket auth required.");
    }

    const user = await this.prisma.client.user.findFirst({
      where: clerkUserId ? { clerkUserId } : { id: platformUserId as string },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });
    if (!user) {
      throw new Error("Socket user not found.");
    }
    if (user.status === UserStatus.DISABLED) {
      throw new Error("Socket user is disabled.");
    }

    return {
      id: user.id,
      clerkUserId: user.clerkUserId,
      email: user.email,
      roles: user.userRoles.map((userRole) => userRole.role.code as RoleCode),
      permissions: Array.from(
        new Set(
          user.userRoles.flatMap((userRole) =>
            userRole.role.rolePermissions.map((rolePermission) => rolePermission.permission.code),
          ),
        ),
      ),
      authProvider: clerkUserId ? "CLERK" : "DEV",
    };
  }

  private allowDevAuth() {
    return process.env.NODE_ENV !== "production" || process.env.INDIHUB_ALLOW_DEV_AUTH === "true";
  }
}

function roomName(enquiryId: string) {
  return `b2b-enquiry:${enquiryId}`;
}
