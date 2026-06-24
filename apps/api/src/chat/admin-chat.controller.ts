import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { ChatService } from "./chat.service";
import {
  AssignChatDto,
  ChatConversationQueryDto,
  ChatInternalNoteDto,
  SendChatMessageDto,
  UpdateChatConversationDto,
} from "./dto/chat.dto";

@ApiTags("Admin Chat")
@Roles(RoleCode.ADMIN, RoleCode.CHAT_SUPPORT)
@Controller("admin/chat")
export class AdminChatController {
  constructor(@Inject(ChatService) private readonly chatService: ChatService) {}

  @Get("conversations")
  @Permissions("chat.read")
  @ApiOperation({ summary: "List support chat conversations for admin or support agents." })
  listConversations(@CurrentUser() actor: RequestUser, @Query() query: ChatConversationQueryDto) {
    return this.chatService.listStaff(actor, query);
  }

  @Get("conversations/:conversationId")
  @Permissions("chat.read")
  @ApiOperation({ summary: "Read a support chat conversation." })
  getConversation(@CurrentUser() actor: RequestUser, @Param("conversationId") conversationId: string) {
    return this.chatService.getStaff(actor, conversationId);
  }

  @Post("conversations/:conversationId/claim")
  @Permissions("chat.claim")
  @ApiOperation({ summary: "Claim an unassigned normal chat conversation." })
  claim(@CurrentUser() actor: RequestUser, @Param("conversationId") conversationId: string) {
    return this.chatService.claim(actor, conversationId);
  }

  @Post("conversations/:conversationId/messages")
  @Permissions("chat.reply")
  @ApiOperation({ summary: "Reply to a support chat conversation." })
  reply(
    @CurrentUser() actor: RequestUser,
    @Param("conversationId") conversationId: string,
    @Body() dto: SendChatMessageDto,
  ) {
    return this.chatService.replyStaff(actor, conversationId, dto);
  }

  @Post("conversations/:conversationId/internal-notes")
  @Permissions("chat.manage")
  @ApiOperation({ summary: "Add an internal chat note visible only to staff." })
  addInternalNote(
    @CurrentUser() actor: RequestUser,
    @Param("conversationId") conversationId: string,
    @Body() dto: ChatInternalNoteDto,
  ) {
    return this.chatService.addInternalNote(actor, conversationId, dto);
  }

  @Patch("conversations/:conversationId")
  @Permissions("chat.manage")
  @ApiOperation({ summary: "Update chat status, priority, topic, or sensitivity." })
  updateConversation(
    @CurrentUser() actor: RequestUser,
    @Param("conversationId") conversationId: string,
    @Body() dto: UpdateChatConversationDto,
  ) {
    return this.chatService.updateConversation(actor, conversationId, dto);
  }

  @Patch("conversations/:conversationId/assignment")
  @Roles(RoleCode.ADMIN)
  @Permissions("chat.manage")
  @ApiOperation({ summary: "Admin assign, reassign, or unassign a support chat conversation." })
  assign(
    @CurrentUser() actor: RequestUser,
    @Param("conversationId") conversationId: string,
    @Body() dto: AssignChatDto,
  ) {
    return this.chatService.assign(actor, conversationId, dto);
  }

  @Post("conversations/:conversationId/support-request")
  @Permissions("chat.manage")
  @ApiOperation({ summary: "Create and link a formal support request from a chat conversation." })
  linkSupportRequest(@CurrentUser() actor: RequestUser, @Param("conversationId") conversationId: string) {
    return this.chatService.linkSupportRequest(actor, conversationId);
  }

  @Patch("conversations/:conversationId/read")
  @Permissions("chat.read")
  @ApiOperation({ summary: "Mark a staff-visible conversation read." })
  markRead(@CurrentUser() actor: RequestUser, @Param("conversationId") conversationId: string) {
    return this.chatService.markRead(actor, conversationId, true);
  }
}
