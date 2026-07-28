import { z } from "zod";
import {
  b2bEnquiryStatuses,
  deliveryModes,
  deliveryStatuses,
  orderStatuses,
  paymentStatuses,
  sellerStatuses,
  sellerTypes,
  supportContactChannels,
  supportRequesterTypes,
  supportRequestTopics
} from "@indihub/shared-types";

export const indianPhoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10 digit Indian mobile number");

export const pincodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Enter a valid 6 digit pincode");

export const moneyPaiseSchema = z.number().int().nonnegative();

export const addressSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: indianPhoneSchema,
  line1: z.string().trim().min(3).max(180),
  line2: z.string().trim().max(180).optional(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: pincodeSchema,
  country: z.string().trim().default("India")
});

export const sellerRegistrationSchema = z.object({
  sellerType: z.enum(sellerTypes),
  storeName: z.string().trim().min(2).max(140),
  contactName: z.string().trim().min(2).max(120),
  contactPhone: indianPhoneSchema,
  contactEmail: z.string().trim().email(),
  address: addressSchema.omit({ fullName: true, phone: true }),
  businessDescription: z.string().trim().max(1200).optional()
});

export const sellerStatusSchema = z.enum(sellerStatuses);

export const productDraftSchema = z.object({
  sellerId: z.string().uuid(),
  categoryId: z.string().uuid(),
  name: z.string().trim().min(2).max(180),
  description: z.string().trim().min(10).max(5000),
  sku: z.string().trim().min(2).max(80),
  pricePaise: moneyPaiseSchema,
  mrpPaise: moneyPaiseSchema.optional(),
  stockQuantity: z.number().int().min(0),
  images: z.array(z.string().url()).max(12).default([])
});

export const cartItemSchema = z.object({
  productVariantId: z.string().uuid(),
  quantity: z.number().int().positive().max(99)
});

export const checkoutSchema = z.object({
  customerId: z.string().uuid(),
  addressId: z.string().uuid(),
  paymentMethod: z.enum(["COD", "RAZORPAY", "BANK_TRANSFER", "MANUAL"]),
  deliveryMode: z.enum(deliveryModes)
});

export const orderStatusSchema = z.enum(orderStatuses);
export const paymentStatusSchema = z.enum(paymentStatuses);
export const deliveryStatusSchema = z.enum(deliveryStatuses);

export const deliveryUpdateSchema = z.object({
  deliveryMode: z.enum(deliveryModes),
  partnerName: z.string().trim().max(120).optional(),
  partnerPhone: indianPhoneSchema.optional(),
  trackingReference: z.string().trim().max(120).optional(),
  estimatedDeliveryDate: z.coerce.date().optional(),
  deliveryNote: z.string().trim().max(1000).optional(),
  status: deliveryStatusSchema
});

export const b2bEnquirySchema = z.object({
  businessBuyerId: z.string().uuid(),
  productId: z.string().uuid().optional(),
  sellerId: z.string().uuid().optional(),
  quantity: z.number().int().positive(),
  message: z.string().trim().min(10).max(2500)
});

export const b2bEnquiryStatusSchema = z.enum(b2bEnquiryStatuses);

export const supportRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  phone: indianPhoneSchema.optional(),
  topic: z.enum(supportRequestTopics).default("GENERAL"),
  requesterType: z.enum(supportRequesterTypes).default("CUSTOMER"),
  preferredContactChannel: z.enum(supportContactChannels).default("EMAIL"),
  orderNumber: z.string().trim().max(80).optional(),
  subject: z.string().trim().min(3).max(180),
  message: z.string().trim().min(10).max(2500)
});

export const authenticatedSupportRequestSchema = supportRequestSchema.extend({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().optional(),
  phone: indianPhoneSchema.optional()
});

export type SellerRegistrationInput = z.infer<typeof sellerRegistrationSchema>;
export type ProductDraftInput = z.infer<typeof productDraftSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type DeliveryUpdateInput = z.infer<typeof deliveryUpdateSchema>;
export type B2BEnquiryInput = z.infer<typeof b2bEnquirySchema>;
export type SupportRequestInput = z.infer<typeof supportRequestSchema>;
export type AuthenticatedSupportRequestInput = z.infer<typeof authenticatedSupportRequestSchema>;
