import { Body, Controller, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { RoleCode } from "@indihub/database";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import type { RequestUser } from "../auth/types/indihub-request";
import { Public } from "../auth/decorators/public.decorator";
import { SettingsService } from "../settings/settings.service";
import { GuidedChatActionDto, HandoverChatDto, SendChatMessageDto, StartChatConversationDto } from "./dto/chat.dto";
import { ChatService } from "./chat.service";

@ApiTags("Chat")
@Roles(RoleCode.CUSTOMER, RoleCode.SELLER, RoleCode.BUSINESS_BUYER, RoleCode.DELIVERY_PARTNER)
@Controller("chat")
export class ChatController {
  constructor(
    @Inject(ChatService) private readonly chatService: ChatService,
    @Inject(SettingsService) private readonly settingsService: SettingsService,
  ) {}

  @Public()
  @Get("config")
  @ApiOperation({ summary: "Read public support chat availability." })
  getConfig() {
    return this.settingsService.getChatSupportConfig();
  }

  @Get("conversations")
  @ApiOperation({ summary: "List the authenticated user's chat conversations." })
  listMine(@CurrentUser() actor: RequestUser) {
    return this.chatService.listMine(actor);
  }

  @Post("conversations")
  @ApiOperation({ summary: "Start a new authenticated chat conversation." })
  startConversation(@CurrentUser() actor: RequestUser, @Body() dto: StartChatConversationDto) {
    return this.chatService.startConversation(actor, dto);
  }

  @Get("conversations/:conversationId")
  @ApiOperation({ summary: "Read one owned chat conversation." })
  getMine(@CurrentUser() actor: RequestUser, @Param("conversationId") conversationId: string) {
    return this.chatService.getMine(actor, conversationId);
  }

  @Post("conversations/:conversationId/messages")
  @ApiOperation({ summary: "Send a user chat message." })
  sendMessage(
    @CurrentUser() actor: RequestUser,
    @Param("conversationId") conversationId: string,
    @Body() dto: SendChatMessageDto,
  ) {
    return this.chatService.sendUserMessage(actor, conversationId, dto);
  }

  @Post("conversations/:conversationId/guided-actions")
  @ApiOperation({ summary: "Run an authenticated guided chat action." })
  guidedAction(
    @CurrentUser() actor: RequestUser,
    @Param("conversationId") conversationId: string,
    @Body() dto: GuidedChatActionDto,
  ) {
    return this.chatService.runGuidedAction(actor, conversationId, dto);
  }

  @Post("conversations/:conversationId/handover")
  @ApiOperation({ summary: "Request support staff handover for a chat conversation." })
  requestHandover(
    @CurrentUser() actor: RequestUser,
    @Param("conversationId") conversationId: string,
    @Body() dto: HandoverChatDto,
  ) {
    return this.chatService.requestHandover(actor, conversationId, dto);
  }

  @Patch("conversations/:conversationId/read")
  @ApiOperation({ summary: "Mark an owned chat conversation read." })
  markRead(@CurrentUser() actor: RequestUser, @Param("conversationId") conversationId: string) {
    return this.chatService.markRead(actor, conversationId);
  }
}
