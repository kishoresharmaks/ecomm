export const EMAIL_QUEUE_NAME = "email.notifications";

export type EmailProviderConfig = {
  brevoApiKey?: string;
  resendApiKey?: string;
  sendgridApiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPassword?: string;
  smtpSecure?: boolean;
  smtpBridgeUrl?: string;
};

export type EmailJobPayload = {
  notificationLogId: string;
  provider: string;
  providerConfig?: EmailProviderConfig;
  recipient: string;
  subject: string;
  body: string;
  fromName: string;
  fromEmail: string;
  templateCode: string;
};

export type EmailDeliveryResult = {
  providerMessageId?: string;
};
