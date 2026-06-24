import { IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import {
  ChatConversationPriority,
  ChatConversationSensitivity,
  ChatConversationStatus,
  ChatEscalationReason,
  ChatRequesterType,
  SupportRequestTopic,
} from "@indihub/database";

export class ChatConversationQueryDto {
  @IsOptional()
  @IsEnum(ChatConversationStatus)
  status?: ChatConversationStatus;

  @IsOptional()
  @IsEnum(ChatConversationPriority)
  priority?: ChatConversationPriority;

  @IsOptional()
  @IsEnum(ChatConversationSensitivity)
  sensitivity?: ChatConversationSensitivity;

  @IsOptional()
  @IsEnum(ChatRequesterType)
  requesterType?: ChatRequesterType;

  @IsOptional()
  @IsIn(["assigned", "unassigned", "mine"])
  assignment?: "assigned" | "unassigned" | "mine";

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class StartChatConversationDto {
  @IsEnum(ChatRequesterType)
  requesterType!: ChatRequesterType;

  @IsEnum(SupportRequestTopic)
  topic!: SupportRequestTopic;

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2500)
  message!: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  b2bEnquiryId?: string;
}

export class SendChatMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2500)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  clientMessageId?: string;
}

export class GuidedChatActionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  action!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  selectedValue?: string;
}

export class HandoverChatDto {
  @IsOptional()
  @IsEnum(ChatEscalationReason)
  reason?: ChatEscalationReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateChatConversationDto {
  @IsOptional()
  @IsEnum(ChatConversationStatus)
  status?: ChatConversationStatus;

  @IsOptional()
  @IsEnum(ChatConversationPriority)
  priority?: ChatConversationPriority;

  @IsOptional()
  @IsEnum(ChatConversationSensitivity)
  sensitivity?: ChatConversationSensitivity;

  @IsOptional()
  @IsEnum(SupportRequestTopic)
  topic?: SupportRequestTopic;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AssignChatDto {
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ChatInternalNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2500)
  note!: string;
}
