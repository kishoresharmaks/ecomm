import {
  supportContactChannels,
  supportRequesterTypes,
  supportRequestTopics,
  type SupportContactChannel,
  type SupportRequesterType,
  type SupportRequestTopic,
} from "@indihub/shared-types";

export const contactTopicLabels: Record<SupportRequestTopic, string> = {
  ORDER: "Order help",
  PAYMENT: "Payment or refund",
  DELIVERY: "Delivery tracking",
  SELLER: "Seller support",
  B2B: "B2B enquiry",
  DOWNLOAD_APP: "Download app",
  GENERAL: "General enquiry",
};

export const contactTopicDescriptions: Record<SupportRequestTopic, string> = {
  ORDER: "Order numbers, item issues, returns, or cancellation questions.",
  PAYMENT: "Payment status, failed transactions, COD, bank transfer, or refund follow-up.",
  DELIVERY: "Shipment tracking, delivery partner coordination, address, or delay support.",
  SELLER: "Seller onboarding, store setup, product approval, payout, or account support.",
  B2B: "Business buyer profile, quotation, procurement, or bulk enquiry support.",
  DOWNLOAD_APP: "Mobile app download, sign-in, install, or device support.",
  GENERAL: "Anything else the marketplace operations team should review.",
};

export const requesterTypeLabels: Record<SupportRequesterType, string> = {
  CUSTOMER: "Customer",
  SELLER: "Seller",
  BUSINESS_BUYER: "Business buyer",
  DELIVERY_PARTNER: "Delivery partner",
  GUEST: "Guest / public visitor",
};

export const contactChannelLabels: Record<SupportContactChannel, string> = {
  EMAIL: "Email",
  PHONE: "Phone",
  WHATSAPP: "WhatsApp",
};

export const supportTopicOptions = supportRequestTopics.map((value) => ({
  value,
  label: contactTopicLabels[value],
  description: contactTopicDescriptions[value],
}));

export const requesterTypeOptions = supportRequesterTypes.map((value) => ({
  value,
  label: requesterTypeLabels[value],
}));

export const contactChannelOptions = supportContactChannels.map((value) => ({
  value,
  label: contactChannelLabels[value],
}));

const topicAliases: Record<string, SupportRequestTopic> = {
  order: "ORDER",
  orders: "ORDER",
  payment: "PAYMENT",
  payments: "PAYMENT",
  refund: "PAYMENT",
  delivery: "DELIVERY",
  shipping: "DELIVERY",
  seller: "SELLER",
  vendor: "SELLER",
  b2b: "B2B",
  business: "B2B",
  "download-app": "DOWNLOAD_APP",
  download_app: "DOWNLOAD_APP",
  app: "DOWNLOAD_APP",
  general: "GENERAL",
};

export function supportTopicFromQuery(value: string | null | undefined): SupportRequestTopic {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return "GENERAL";
  }

  const direct = supportRequestTopics.find((topic) => topic.toLowerCase() === normalized);
  return direct ?? topicAliases[normalized] ?? "GENERAL";
}

export function defaultSubjectForTopic(topic: SupportRequestTopic) {
  if (topic === "DOWNLOAD_APP") {
    return "App download support";
  }
  return `${contactTopicLabels[topic]} request`;
}
