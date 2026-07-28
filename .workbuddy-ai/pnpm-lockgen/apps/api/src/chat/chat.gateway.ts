import { Inject, OnModuleInit } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { RoleCode } from "@indihub/database";
import { AdminAuthService } from "../auth/admin-auth.service";
import { ClerkAuthService } from "../auth/clerk-auth.service";
import type { RequestUser } from "../auth/types/indihub-request";
import { PrismaService } from "../prisma/prisma.service";
import { ChatService } from "./chat.service";

type ChatSocket = Socket & { data: { user?: RequestUser } };

@WebSocketGateway({
  namespace: "/chat",
  cors: { origin: true, credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnModuleInit {
  @WebSocketServer()
  private server!: Server;

  constructor(
    @Inject(ChatService) private readonly chatService: ChatService,
    @Inject(AdminAuthService) private readonly adminAuthService: AdminAuthService,
    @Inject(ClerkAuthService) private readonly clerkAuthService: ClerkAuthService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.chatService.setBroadcaster((event) => {
      this.server.to(roomName(event.conversationId)).emit(event.type, event);
    });
  }

  async handleConnection(client: ChatSocket) {
    try {
      client.data.user = await this.resolveUser(client);
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage("join")
  async joinConversation(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: { conversationId?: string },
  ) {
    const actor = client.data.user;
    const conversationId = body.conversationId;
    if (!actor || !conversationId) {
      return { ok: false };
    }
    const allowed = await this.canJoin(actor, conversationId);
    if (!allowed) {
      return { ok: false };
    }
    await client.join(roomName(conversationId));
    return { ok: true };
  }

  @SubscribeMessage("leave")
  async leaveConversation(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: { conversationId?: string },
  ) {
    if (body.conversationId) {
      await client.leave(roomName(body.conversationId));
    }
    return { ok: true };
  }

  private async canJoin(actor: RequestUser, conversationId: string) {
    if (actor.roles.includes(RoleCode.ADMIN)) {
      return Boolean(await this.prisma.client.chatConversation.findUnique({ where: { id: conversationId } }));
    }
    if (actor.roles.includes(RoleCode.CHAT_SUPPORT)) {
      return Boolean(
        await this.prisma.client.chatConversation.findFirst({
          where: {
            id: conversationId,
            sensitivity: "NORMAL",
            OR: [{ assignedToUserId: actor.id }, { assignedToUserId: null }],
          },
        }),
      );
    }
    return Boolean(
      await this.prisma.client.chatConversation.findFirst({
        where: { id: conversationId, userId: actor.id },
      }),
    );
  }

  private async resolveUser(client: Socket): Promise<RequestUser> {
    const auth = client.handshake.auth as Record<string, string | undefined>;
    const bearerToken = auth.token;
    const adminUser = await this.adminAuthService.resolveAuthorizationHeader(
      bearerToken ? `Bearer ${bearerToken}` : undefined,
    );
    if (adminUser) {
      return adminUser;
    }

    const clerkToken = auth.clerkToken;
    const clerkUserId = clerkToken
      ? await this.clerkAuthService.verifyAuthorizationHeader(`Bearer ${clerkToken}`)
      : auth.clerkUserId;
    const platformUserId = auth.platformUserId;
    if (!clerkUserId && !platformUserId) {
      throw new Error("Socket auth required.");
    }
    const userWhere = clerkUserId ? { clerkUserId } : platformUserId ? { id: platformUserId } : null;
    if (!userWhere) {
      throw new Error("Socket auth required.");
    }
    const user = await this.prisma.client.user.findFirst({
      where: userWhere,
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
}

function roomName(conversationId: string) {
  return `chat:${conversationId}`;
}
