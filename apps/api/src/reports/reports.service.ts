import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import {
  ApprovalStatus,
  B2BEnquiryStatus,
  B2BOrderStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ProductStatus,
  ReturnRequestStatus,
  SellerPayoutStatus,
  ServiceBookingStatus,
  ServiceListingStatus,
} from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { PrismaService } from "../prisma/prisma.service";
import { ReportQueryDto } from "./dto/report-query.dto";

@Injectable()
export class ReportsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async overview(query: ReportQueryDto) {
    const createdAt = this.dateRange(query);
    const orderWhere: Prisma.OrderWhereInput = createdAt ? { createdAt } : {};
    const b2bWhere: Prisma.B2BEnquiryWhereInput = createdAt ? { createdAt } : {};
    const supportWhere: Prisma.SupportRequestWhereInput = createdAt ? { createdAt } : {};
    const [sales, orders, customers, sellers, products, b2bEnquiries, supportRequests] = await this.prisma.client.$transaction(async (tx) => {
      const sales = await tx.order.aggregate({
        where: { ...orderWhere, orderStatus: { not: OrderStatus.CANCELLED } },
        _sum: { totalPaise: true, subtotalPaise: true, shippingPaise: true },
        _count: true
      });
      const orders = await tx.order.groupBy({
        by: ["orderStatus"],
        where: orderWhere,
        _count: true
      });
      const customers = await tx.customer.count();
      const sellers = await tx.seller.count();
      const products = await tx.product.count({ where: { deletedAt: null } });
      const b2bEnquiries = await tx.b2BEnquiry.count({ where: b2bWhere });
      const supportRequests = await tx.supportRequest.count({ where: supportWhere });

      return [sales, orders, customers, sellers, products, b2bEnquiries, supportRequests] as const;
    });

    return {
      totals: {
        revenuePaise: sales._sum?.totalPaise ?? 0,
        subtotalPaise: sales._sum?.subtotalPaise ?? 0,
        shippingPaise: sales._sum?.shippingPaise ?? 0,
        orderCount: sales._count,
        customers,
        sellers,
        products,
        b2bEnquiries,
        supportRequests
      },
      ordersByStatus: orders
    };
  }

  async sales(query: ReportQueryDto) {
    const createdAt = this.dateRange(query);
    const orderWhere = this.reportableOrderWhere(createdAt);
    const paymentWhere: Prisma.PaymentWhereInput = { order: orderWhere };
    const [summary, payments, recentOrders] = await this.prisma.client.$transaction(async (tx) => {
      const summary = await tx.order.aggregate({
        where: orderWhere,
        _sum: { totalPaise: true, subtotalPaise: true, shippingPaise: true },
        _count: true
      });
      const payments = await tx.payment.groupBy({
        by: ["status", "provider"],
        where: paymentWhere,
        _sum: { amountPaise: true },
        _count: true
      });
      const recentOrders = await tx.order.findMany({
        where: orderWhere,
        orderBy: { createdAt: "desc" },
        take: 25,
        include: { customer: { include: { user: true } } }
      });

      return [summary, payments, recentOrders] as const;
    });

    return {
      summary: {
        totalPaise: summary._sum?.totalPaise ?? 0,
        subtotalPaise: summary._sum?.subtotalPaise ?? 0,
        shippingPaise: summary._sum?.shippingPaise ?? 0,
        orderCount: summary._count
      },
      payments,
      recentOrders
    };
  }

  async sellers(query: ReportQueryDto) {
    const createdAt = this.dateRange(query);
    const splitWhere: Prisma.OrderSellerSplitWhereInput = { order: this.reportableOrderWhere(createdAt) };
    const [sellerGroups, pendingSellers, approvedSellers] = await this.prisma.client.$transaction(async (tx) => {
      const sellerGroups = await tx.orderSellerSplit.groupBy({
        by: ["sellerId"],
        where: splitWhere,
        _count: true,
        _sum: {
          sellerSubtotalPaise: true
        },
        orderBy: {
          _sum: {
            sellerSubtotalPaise: "desc"
          }
        },
        take: 50
      });
      const pendingSellers = await tx.seller.count({ where: { approvalStatus: ApprovalStatus.PENDING_APPROVAL, deletedAt: null } });
      const approvedSellers = await tx.seller.count({ where: { approvalStatus: ApprovalStatus.APPROVED, deletedAt: null } });

      return [sellerGroups, pendingSellers, approvedSellers] as const;
    });

    const sellers = await this.prisma.client.seller.findMany({
      where: { id: { in: sellerGroups.map((group) => group.sellerId) } },
      select: { id: true, storeName: true }
    });
    const sellerNameMap = new Map(sellers.map((seller) => [seller.id, seller.storeName]));

    return {
      summary: { pendingSellers, approvedSellers },
      sellers: sellerGroups.map((group) => ({
        sellerId: group.sellerId,
        storeName: sellerNameMap.get(group.sellerId) ?? "Seller",
        orderCount: group._count,
        salesPaise: group._sum.sellerSubtotalPaise ?? 0
      }))
    };
  }

  async products(query: ReportQueryDto) {
    const createdAt = this.dateRange(query);
    const orderItemWhere: Prisma.OrderItemWhereInput = { order: this.reportableOrderWhere(createdAt) };
    const [pendingProducts, activeProducts, lowStockProducts, productGroups] = await this.prisma.client.$transaction(async (tx) => {
      const pendingProducts = await tx.product.count({ where: { approvalStatus: ApprovalStatus.PENDING_APPROVAL, deletedAt: null } });
      const activeProducts = await tx.product.count({ where: { status: ProductStatus.ACTIVE, deletedAt: null } });
      const lowStockProducts = await tx.productVariant.findMany({
        where: { stockQuantity: { lte: 5 }, product: { deletedAt: null } },
        include: { product: true },
        take: 25,
          orderBy: { stockQuantity: "asc" }
      });
      const productGroups = await tx.orderItem.groupBy({
        by: ["productId"],
        where: orderItemWhere,
        _sum: {
          quantity: true,
          lineTotalPaise: true
        },
        orderBy: {
          _sum: {
            lineTotalPaise: "desc"
          }
        },
        take: 50
      });

      return [pendingProducts, activeProducts, lowStockProducts, productGroups] as const;
    });

    const products = await this.prisma.client.product.findMany({
      where: { id: { in: productGroups.map((group) => group.productId) } },
      select: { id: true, name: true }
    });
    const productNameMap = new Map(products.map((product) => [product.id, product.name]));

    return {
      summary: { pendingProducts, activeProducts },
      topProducts: productGroups.map((group) => ({
        productId: group.productId,
        productName: productNameMap.get(group.productId) ?? "Product",
        quantity: group._sum.quantity ?? 0,
        salesPaise: group._sum.lineTotalPaise ?? 0
      })),
      lowStockProducts
    };
  }

  async enquiries(query: ReportQueryDto) {
    const createdAt = this.dateRange(query);
    const b2bWhere: Prisma.B2BEnquiryWhereInput = createdAt ? { createdAt } : {};
    const activeB2BWhere: Prisma.B2BEnquiryWhereInput = {
      ...b2bWhere,
      status: { not: B2BEnquiryStatus.CANCELLED }
    };
    const supportWhere: Prisma.SupportRequestWhereInput = createdAt ? { createdAt } : {};
    const [b2bByStatus, supportByStatus, recentB2B, recentSupport] = await this.prisma.client.$transaction(async (tx) => {
      const b2bByStatus = await tx.b2BEnquiry.groupBy({
        by: ["status"],
        where: b2bWhere,
        _count: true
      });
      const supportByStatus = await tx.supportRequest.groupBy({
        by: ["status"],
        where: supportWhere,
        _count: true
      });
      const recentB2B = await tx.b2BEnquiry.findMany({
        where: activeB2BWhere,
        include: { businessBuyer: true, product: true, seller: true },
        orderBy: { createdAt: "desc" },
        take: 25
      });
      const recentSupport = await tx.supportRequest.findMany({
        where: supportWhere,
        orderBy: { createdAt: "desc" },
        take: 25
      });

      return [b2bByStatus, supportByStatus, recentB2B, recentSupport] as const;
    });

    return {
      b2bByStatus,
      supportByStatus,
      recentB2B,
      recentSupport
    };
  }

  async sellerSales(actor: RequestUser, query: ReportQueryDto) {
    const seller = await this.prisma.client.seller.findUnique({
      where: { userId: actor.id }
    });

    if (!seller) {
      throw new ForbiddenException("Seller account is required.");
    }

    const createdAt = this.dateRange(query);
    const splitWhere: Prisma.OrderSellerSplitWhereInput = {
      sellerId: seller.id,
      order: this.reportableOrderWhere(createdAt)
    };
    const b2bEnquiryWhere: Prisma.B2BEnquiryWhereInput = {
      sellerId: seller.id,
      ...(createdAt ? { createdAt } : {})
    };
    const b2bOrderWhere: Prisma.B2BOrderWhereInput = {
      sellerId: seller.id,
      ...(createdAt ? { createdAt } : {})
    };
    const reportableB2BOrderWhere: Prisma.B2BOrderWhereInput = {
      ...b2bOrderWhere,
      status: { not: B2BOrderStatus.CANCELLED }
    };
    const serviceBookingWhere: Prisma.ServiceBookingWhereInput = {
      sellerId: seller.id,
      ...(createdAt ? { createdAt } : {})
    };
    const reportableServiceBookingWhere: Prisma.ServiceBookingWhereInput = {
      ...serviceBookingWhere,
      status: { notIn: [ServiceBookingStatus.CANCELLED, ServiceBookingStatus.REJECTED, ServiceBookingStatus.CANCELLED_AFTER_DISPUTE] }
    };
    const serviceListingWhere: Prisma.ServiceListingWhereInput = {
      sellerId: seller.id,
      deletedAt: null
    };

    const [
      summary,
      splits,
      products,
      lowStockCount,
      lowStockProducts,
      b2bEnquiries,
      b2bEnquiriesByStatus,
      b2bOrders,
      b2bOrdersByStatus,
      b2bOrdersByPaymentStatus,
      recentB2BOrders,
      serviceListings,
      activeServiceListings,
      serviceBookings,
      serviceBookingsByStatus,
      servicePayments,
      servicePaymentsByStatus,
      recentServiceBookings,
    ] = await this.prisma.client.$transaction(async (tx) => {
      const summary = await tx.orderSellerSplit.aggregate({
        where: splitWhere,
        _count: true,
        _sum: {
          sellerSubtotalPaise: true,
          commissionPaise: true,
          gstOnCommissionPaise: true,
          tdsPaise: true,
          tcsPaise: true,
          platformFeePaise: true,
          couponSellerFundedDiscountPaise: true,
          couponAdjustmentPaise: true,
          refundAdjustmentPaise: true
        }
      });
      const splits = await tx.orderSellerSplit.findMany({
        where: splitWhere,
        include: {
          order: {
            include: {
              customer: { include: { user: true } }
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 50
      });
      const products = await tx.product.count({
        where: { sellerId: seller.id, deletedAt: null }
      });
      const lowStockWhere: Prisma.ProductVariantWhereInput = {
        stockQuantity: { lte: 5 },
        product: {
          sellerId: seller.id,
          deletedAt: null
        }
      };
      const lowStockCount = await tx.productVariant.count({
        where: lowStockWhere
      });
      const lowStockProducts = await tx.productVariant.findMany({
        where: lowStockWhere,
        include: { product: true },
        take: 25,
        orderBy: { stockQuantity: "asc" }
      });
      const b2bEnquiries = await tx.b2BEnquiry.count({
        where: b2bEnquiryWhere
      });
      const b2bEnquiriesByStatus = await tx.b2BEnquiry.groupBy({
        by: ["status"],
        where: b2bEnquiryWhere,
        _count: true
      });
      const b2bOrders = await tx.b2BOrder.aggregate({
        where: reportableB2BOrderWhere,
        _count: true,
        _sum: {
          subtotalPaise: true,
          buyerPayableAmountPaise: true,
          paidAmountPaise: true,
          commissionAmountPaise: true,
          sellerPayoutAmountPaise: true
        }
      });
      const b2bOrdersByStatus = await tx.b2BOrder.groupBy({
        by: ["status"],
        where: b2bOrderWhere,
        _count: true,
        _sum: {
          buyerPayableAmountPaise: true,
          sellerPayoutAmountPaise: true
        }
      });
      const b2bOrdersByPaymentStatus = await tx.b2BOrder.groupBy({
        by: ["paymentStatus"],
        where: b2bOrderWhere,
        _count: true,
        _sum: {
          paidAmountPaise: true,
          buyerPayableAmountPaise: true
        }
      });
      const recentB2BOrders = await tx.b2BOrder.findMany({
        where: b2bOrderWhere,
        include: {
          businessBuyer: true,
          product: true
        },
        orderBy: { createdAt: "desc" },
        take: 10
      });
      const serviceListings = await tx.serviceListing.count({
        where: serviceListingWhere
      });
      const activeServiceListings = await tx.serviceListing.count({
        where: {
          ...serviceListingWhere,
          status: ServiceListingStatus.ACTIVE,
          approvalStatus: ApprovalStatus.APPROVED
        }
      });
      const serviceBookings = await tx.serviceBooking.aggregate({
        where: reportableServiceBookingWhere,
        _count: true,
        _sum: {
          totalPayablePaise: true,
          paidAmountPaise: true
        }
      });
      const serviceBookingsByStatus = await tx.serviceBooking.groupBy({
        by: ["status"],
        where: serviceBookingWhere,
        _count: true,
        _sum: {
          totalPayablePaise: true,
          paidAmountPaise: true
        }
      });
      const servicePayments = await tx.servicePayment.aggregate({
        where: {
          sellerId: seller.id,
          status: PaymentStatus.PAID,
          ...(createdAt ? { createdAt } : {})
        },
        _count: true,
        _sum: {
          amountPaise: true
        }
      });
      const servicePaymentsByStatus = await tx.servicePayment.groupBy({
        by: ["status"],
        where: {
          sellerId: seller.id,
          ...(createdAt ? { createdAt } : {})
        },
        _count: true,
        _sum: {
          amountPaise: true
        }
      });
      const recentServiceBookings = await tx.serviceBooking.findMany({
        where: serviceBookingWhere,
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              slug: true
            }
          },
          customer: {
            include: {
              user: {
                select: {
                  email: true,
                  fullName: true,
                  phone: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 10
      });

      return [
        summary,
        splits,
        products,
        lowStockCount,
        lowStockProducts,
        b2bEnquiries,
        b2bEnquiriesByStatus,
        b2bOrders,
        b2bOrdersByStatus,
        b2bOrdersByPaymentStatus,
        recentB2BOrders,
        serviceListings,
        activeServiceListings,
        serviceBookings,
        serviceBookingsByStatus,
        servicePayments,
        servicePaymentsByStatus,
        recentServiceBookings,
      ] as const;
    });

    const totalSalesPaise = summary._sum.sellerSubtotalPaise ?? 0;
    const commissionPaise = summary._sum.commissionPaise ?? 0;
    const gstOnCommissionPaise = summary._sum.gstOnCommissionPaise ?? 0;
    const tdsPaise = summary._sum.tdsPaise ?? 0;
    const tcsPaise = summary._sum.tcsPaise ?? 0;
    const platformFeePaise = summary._sum.platformFeePaise ?? 0;
    const couponSellerFundedDiscountPaise =
      summary._sum.couponSellerFundedDiscountPaise ?? 0;
    const couponAdjustmentPaise = summary._sum.couponAdjustmentPaise ?? 0;
    const refundAdjustmentPaise = summary._sum.refundAdjustmentPaise ?? 0;
    const netSalesPaise =
      totalSalesPaise -
      commissionPaise -
      gstOnCommissionPaise -
      tdsPaise -
      tcsPaise -
      platformFeePaise -
      couponSellerFundedDiscountPaise +
      couponAdjustmentPaise +
      refundAdjustmentPaise;

    return {
      seller: {
        id: seller.id,
        primaryCapability: seller.primaryCapability,
        enabledCapabilities: seller.enabledCapabilities
      },
      summary: {
        orderCount: summary._count,
        totalSalesPaise,
        commissionPaise,
        gstOnCommissionPaise,
        tdsPaise,
        tcsPaise,
        platformFeePaise,
        couponSellerFundedDiscountPaise,
        couponAdjustmentPaise,
        refundAdjustmentPaise,
        netSalesPaise,
        products,
        lowStockCount,
        b2bEnquiries,
        b2bOrders: b2bOrders._count,
        b2bOrderValuePaise: b2bOrders._sum.buyerPayableAmountPaise ?? 0,
        serviceBookings: serviceBookings._count,
        serviceRevenuePaise: servicePayments._sum.amountPaise ?? 0,
        serviceListings
      },
      b2b: {
        enquiryCount: b2bEnquiries,
        orderCount: b2bOrders._count,
        subtotalPaise: b2bOrders._sum.subtotalPaise ?? 0,
        buyerPayablePaise: b2bOrders._sum.buyerPayableAmountPaise ?? 0,
        paidAmountPaise: b2bOrders._sum.paidAmountPaise ?? 0,
        commissionPaise: b2bOrders._sum.commissionAmountPaise ?? 0,
        sellerPayoutPaise: b2bOrders._sum.sellerPayoutAmountPaise ?? 0,
        byEnquiryStatus: b2bEnquiriesByStatus.map((item) => ({
          status: item.status,
          count: item._count
        })),
        byOrderStatus: b2bOrdersByStatus.map((item) => ({
          status: item.status,
          count: item._count,
          buyerPayablePaise: item._sum.buyerPayableAmountPaise ?? 0,
          sellerPayoutPaise: item._sum.sellerPayoutAmountPaise ?? 0
        })),
        byPaymentStatus: b2bOrdersByPaymentStatus.map((item) => ({
          status: item.paymentStatus,
          count: item._count,
          paidAmountPaise: item._sum.paidAmountPaise ?? 0,
          buyerPayablePaise: item._sum.buyerPayableAmountPaise ?? 0
        })),
        recentOrders: recentB2BOrders
      },
      services: {
        listingCount: serviceListings,
        activeListingCount: activeServiceListings,
        bookingCount: serviceBookings._count,
        totalPayablePaise: serviceBookings._sum.totalPayablePaise ?? 0,
        paidAmountPaise: serviceBookings._sum.paidAmountPaise ?? 0,
        paidPaymentCount: servicePayments._count,
        paidPaymentPaise: servicePayments._sum.amountPaise ?? 0,
        byBookingStatus: serviceBookingsByStatus.map((item) => ({
          status: item.status,
          count: item._count,
          totalPayablePaise: item._sum.totalPayablePaise ?? 0,
          paidAmountPaise: item._sum.paidAmountPaise ?? 0
        })),
        byPaymentStatus: servicePaymentsByStatus.map((item) => ({
          status: item.status,
          count: item._count,
          amountPaise: item._sum.amountPaise ?? 0
        })),
        recentBookings: recentServiceBookings
      },
      recentOrders: splits,
      lowStockProducts
    };
  }

  async sellerReportsOverview(actor: RequestUser, query: ReportQueryDto) {
    const seller = await this.requireSeller(actor);
    const createdAt = this.dateRange(query);
    const splitWhere: Prisma.OrderSellerSplitWhereInput = { sellerId: seller.id, order: this.reportableOrderWhere(createdAt) };
    const b2bWhere: Prisma.B2BOrderWhereInput = { sellerId: seller.id, status: { not: B2BOrderStatus.CANCELLED }, ...(createdAt ? { createdAt } : {}) };
    const returnWhere: Prisma.ReturnRequestWhereInput = { items: { some: { sellerId: seller.id } }, ...(createdAt ? { createdAt } : {}) };
    const [splitAgg, payoutAgg, lowStockCount, productCount, b2bCount, returnCount] = await this.prisma.client.$transaction(async (tx) => {
      const splitAgg = await tx.orderSellerSplit.aggregate({ where: splitWhere, _count: true, _sum: { sellerSubtotalPaise: true, netPayablePaise: true, gstOnCommissionPaise: true, tdsPaise: true, tcsPaise: true, commissionPaise: true, refundAdjustmentPaise: true } });
      const payoutAgg = await tx.sellerPayout.aggregate({ where: { sellerId: seller.id, status: SellerPayoutStatus.PAID }, _sum: { netPayablePaise: true }, _count: true });
      const lowStockCount = await tx.productVariant.count({ where: { stockQuantity: { lte: 5 }, product: { sellerId: seller.id, deletedAt: null } } });
      const productCount = await tx.product.count({ where: { sellerId: seller.id, deletedAt: null } });
      const b2bCount = await tx.b2BOrder.count({ where: b2bWhere });
      const returnCount = await tx.returnRequest.count({ where: returnWhere });
      return [splitAgg, payoutAgg, lowStockCount, productCount, b2bCount, returnCount] as const;
    });
    return {
      totalSalesPaise: splitAgg._sum.sellerSubtotalPaise ?? 0,
      netSalesPaise: splitAgg._sum.netPayablePaise ?? 0,
      commissionPaise: splitAgg._sum.commissionPaise ?? 0,
      gstOnCommissionPaise: splitAgg._sum.gstOnCommissionPaise ?? 0,
      orderCount: splitAgg._count,
      products: productCount,
      lowStockCount,
      paidPayoutsPaise: payoutAgg._sum.netPayablePaise ?? 0,
      paidPayoutsCount: payoutAgg._count,
      b2bOrderCount: b2bCount,
      returnCount
    };
  }

  async sellerInventoryReport(actor: RequestUser, query: ReportQueryDto) {
    const seller = await this.requireSeller(actor);
    const createdAt = this.dateRange(query);
    const splitWhere: Prisma.OrderSellerSplitWhereInput = { sellerId: seller.id, order: this.reportableOrderWhere(createdAt) };
    const variantWhere: Prisma.ProductVariantWhereInput = { product: { sellerId: seller.id, deletedAt: null } };
    const [productCount, activeProductCount, variantCount, lowStockVariants, allVariants, topSoldItems] = await this.prisma.client.$transaction(async (tx) => {
      const productCount = await tx.product.count({ where: { sellerId: seller.id, deletedAt: null } });
      const activeProductCount = await tx.product.count({ where: { sellerId: seller.id, status: ProductStatus.ACTIVE, deletedAt: null } });
      const variantCount = await tx.productVariant.count({ where: variantWhere });
      const lowStockVariants = await tx.productVariant.findMany({ where: { ...variantWhere, stockQuantity: { lte: 5 } }, include: { product: { select: { id: true, name: true, status: true } } }, orderBy: { stockQuantity: "asc" }, take: 50 });
      const allVariants = await tx.productVariant.findMany({ where: variantWhere, include: { product: { select: { id: true, name: true, status: true } } }, orderBy: { stockQuantity: "asc" }, take: 100 });
      const topSoldItems = await tx.orderItem.groupBy({ by: ["productId"], where: { sellerId: seller.id, order: this.reportableOrderWhere(createdAt) }, _sum: { quantity: true, lineTotalPaise: true }, orderBy: { _sum: { quantity: "desc" } }, take: 10 });
      return [productCount, activeProductCount, variantCount, lowStockVariants, allVariants, topSoldItems] as const;
    });
    const products = await this.prisma.client.product.findMany({ where: { id: { in: topSoldItems.map((i) => i.productId) }, sellerId: seller.id }, select: { id: true, name: true } });
    const productNameMap = new Map(products.map((p) => [p.id, p.name]));
    return {
      summary: { productCount, activeProductCount, variantCount, lowStockCount: lowStockVariants.length },
      splits: await this.prisma.client.orderSellerSplit.findMany({ where: splitWhere, select: { id: true, sellerSubtotalPaise: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 10 }),
      lowStockVariants,
      variants: allVariants,
      topSoldItems: topSoldItems.map((i) => ({ productId: i.productId, productName: productNameMap.get(i.productId) ?? "Product", quantitySold: i._sum.quantity ?? 0, revenuePaise: i._sum.lineTotalPaise ?? 0 }))
    };
  }

  async sellerFinanceReport(actor: RequestUser, query: ReportQueryDto) {
    const seller = await this.requireSeller(actor);
    const createdAt = this.dateRange(query);
    const splitWhere: Prisma.OrderSellerSplitWhereInput = { sellerId: seller.id, order: this.reportableOrderWhere(createdAt) };
    const payoutDateWhere = createdAt ? { createdAt } : {};
    const [splitAgg, pendingPayouts, paidPayouts, recentPayouts, ledgerEntries] = await this.prisma.client.$transaction(async (tx) => {
      const splitAgg = await tx.orderSellerSplit.aggregate({ where: splitWhere, _sum: { sellerSubtotalPaise: true, commissionPaise: true, netPayablePaise: true, refundAdjustmentPaise: true, platformFeePaise: true }, _count: true });
      const pendingPayouts = await tx.sellerPayout.aggregate({ where: { sellerId: seller.id, status: { in: [SellerPayoutStatus.PENDING_APPROVAL, SellerPayoutStatus.APPROVED] } }, _sum: { netPayablePaise: true }, _count: true });
      const paidPayouts = await tx.sellerPayout.aggregate({ where: { sellerId: seller.id, status: SellerPayoutStatus.PAID, ...payoutDateWhere }, _sum: { netPayablePaise: true, grossSalesPaise: true }, _count: true });
      const recentPayouts = await tx.sellerPayout.findMany({ where: { sellerId: seller.id, ...payoutDateWhere }, orderBy: { createdAt: "desc" }, take: 20 });
      const ledgerEntries = await tx.sellerLedgerEntry.findMany({ where: { sellerId: seller.id, ...(createdAt ? { createdAt } : {}) }, orderBy: { createdAt: "desc" }, take: 20 });
      return [splitAgg, pendingPayouts, paidPayouts, recentPayouts, ledgerEntries] as const;
    });
    const eligibleSplits = await this.prisma.client.orderSellerSplit.aggregate({ where: { sellerId: seller.id, isSettlementEligible: true, payoutId: null }, _sum: { netPayablePaise: true }, _count: true });
    return {
      summary: { grossSalesPaise: splitAgg._sum.sellerSubtotalPaise ?? 0, commissionPaise: splitAgg._sum.commissionPaise ?? 0, netPayablePaise: splitAgg._sum.netPayablePaise ?? 0, refundAdjustmentPaise: splitAgg._sum.refundAdjustmentPaise ?? 0, platformFeePaise: splitAgg._sum.platformFeePaise ?? 0, orderCount: splitAgg._count, pendingPayoutsPaise: pendingPayouts._sum.netPayablePaise ?? 0, pendingPayoutsCount: pendingPayouts._count, paidPayoutsPaise: paidPayouts._sum.netPayablePaise ?? 0, paidPayoutsCount: paidPayouts._count, eligiblePaise: eligibleSplits._sum.netPayablePaise ?? 0, eligibleCount: eligibleSplits._count },
      recentPayouts,
      ledgerEntries
    };
  }

  async sellerTaxReport(actor: RequestUser, query: ReportQueryDto) {
    const seller = await this.requireSeller(actor);
    const createdAt = this.dateRange(query);
    const splitWhere: Prisma.OrderSellerSplitWhereInput = { sellerId: seller.id, order: this.reportableOrderWhere(createdAt) };
    const [taxAgg, splits] = await this.prisma.client.$transaction(async (tx) => {
      const taxAgg = await tx.orderSellerSplit.aggregate({ where: splitWhere, _sum: { sellerSubtotalPaise: true, commissionPaise: true, gstOnCommissionPaise: true, tdsPaise: true, tcsPaise: true, platformFeePaise: true, couponSellerFundedDiscountPaise: true, netPayablePaise: true }, _count: true });
      const splits = await tx.orderSellerSplit.findMany({ where: splitWhere, include: { order: { select: { orderNumber: true, createdAt: true, currency: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
      return [taxAgg, splits] as const;
    });
    const totalDeductionsPaise = (taxAgg._sum.commissionPaise ?? 0) + (taxAgg._sum.gstOnCommissionPaise ?? 0) + (taxAgg._sum.tdsPaise ?? 0) + (taxAgg._sum.tcsPaise ?? 0) + (taxAgg._sum.platformFeePaise ?? 0);
    return {
      summary: { orderCount: taxAgg._count, grossSalesPaise: taxAgg._sum.sellerSubtotalPaise ?? 0, commissionPaise: taxAgg._sum.commissionPaise ?? 0, gstOnCommissionPaise: taxAgg._sum.gstOnCommissionPaise ?? 0, tdsPaise: taxAgg._sum.tdsPaise ?? 0, tcsPaise: taxAgg._sum.tcsPaise ?? 0, platformFeePaise: taxAgg._sum.platformFeePaise ?? 0, couponDiscountPaise: taxAgg._sum.couponSellerFundedDiscountPaise ?? 0, netPayablePaise: taxAgg._sum.netPayablePaise ?? 0, totalDeductionsPaise },
      splits
    };
  }

  async sellerReturnsReport(actor: RequestUser, query: ReportQueryDto) {
    const seller = await this.requireSeller(actor);
    const createdAt = this.dateRange(query);
    const returnItemWhere: Prisma.ReturnRequestItemWhereInput = { sellerId: seller.id, ...(createdAt ? { createdAt } : {}) };
    const returnWhere: Prisma.ReturnRequestWhereInput = { items: { some: { sellerId: seller.id } }, ...(createdAt ? { createdAt } : {}) };
    const [byStatus, itemAgg, recentReturns] = await this.prisma.client.$transaction(async (tx) => {
      const byStatus = await tx.returnRequest.groupBy({ by: ["status"], where: returnWhere, _count: true, _sum: { requestedAmountPaise: true, approvedAmountPaise: true } });
      const itemAgg = await tx.returnRequestItem.aggregate({ where: returnItemWhere, _count: true, _sum: { requestedRefundPaise: true, approvedRefundPaise: true } });
      const recentReturns = await tx.returnRequest.findMany({ where: returnWhere, include: { order: { select: { orderNumber: true } } }, orderBy: { requestedAt: "desc" }, take: 50 });
      return [byStatus, itemAgg, recentReturns] as const;
    });
    const approvedCount = byStatus.find((s) => s.status === ReturnRequestStatus.APPROVED)?._count ?? 0;
    const pendingCount = byStatus.find((s) => s.status === ReturnRequestStatus.PENDING_REVIEW)?._count ?? 0;
    const totalCount = byStatus.reduce((acc, s) => acc + s._count, 0);
    return {
      summary: { totalCount, approvedCount, pendingCount, requestedAmountPaise: itemAgg._sum?.requestedRefundPaise ?? 0, approvedAmountPaise: itemAgg._sum?.approvedRefundPaise ?? 0, itemCount: itemAgg._count },
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count, requestedAmountPaise: s._sum?.requestedAmountPaise ?? 0, approvedAmountPaise: s._sum?.approvedAmountPaise ?? 0 })),
      recentReturns
    };
  }

  private async requireSeller(actor: RequestUser) {
    const seller = await this.prisma.client.seller.findUnique({ where: { userId: actor.id } });
    if (!seller) throw new ForbiddenException("Seller account is required.");
    return seller;
  }

  private dateRange(query: ReportQueryDto): Prisma.DateTimeFilter | undefined {
    if (!query.dateFrom && !query.dateTo) {
      return undefined;
    }

    return {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(query.dateTo) } : {})
    };
  }

  private reportableOrderWhere(createdAt?: Prisma.DateTimeFilter): Prisma.OrderWhereInput {
    return {
      ...(createdAt ? { createdAt } : {}),
      orderStatus: { not: OrderStatus.CANCELLED }
    };
  }
}
