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
  ReportExportType,
  SellerPayoutStatus,
  SellerSettlementStatus,
  ServiceBookingStatus,
  ServiceListingStatus,
  reportExportTablePage,
} from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { FinanceCalculatorService } from "../finance/finance-calculator.service";
import { MarketService, type MarketCurrencySnapshot } from "../market/market.service";
import { PrismaService } from "../prisma/prisma.service";
import { AdminGstReportQueryDto } from "./dto/gst-report-query.dto";
import { ReportQueryDto } from "./dto/report-query.dto";
import { OperationalReportQueryDto } from "./dto/operational-report-query.dto";
import { GstComplianceService } from "./gst-compliance.service";

const sellerSalesSummaryMoneyFields = [
  "totalSalesPaise",
  "commissionPaise",
  "gstOnCommissionPaise",
  "tdsPaise",
  "tcsPaise",
  "platformFeePaise",
  "couponSellerFundedDiscountPaise",
  "couponAdjustmentPaise",
  "refundAdjustmentPaise",
  "netSalesPaise",
  "b2bOrderValuePaise",
  "serviceRevenuePaise",
] as const;

const sellerSplitMoneyFields = [
  "sellerSubtotalPaise",
  "commissionPaise",
  "gstOnCommissionPaise",
  "tdsPaise",
  "tcsPaise",
  "platformFeePaise",
  "couponSellerFundedDiscountPaise",
  "couponAdjustmentPaise",
  "refundAdjustmentPaise",
  "netPayablePaise",
] as const;

const b2bOrderMoneyFields = [
  "subtotalPaise",
  "buyerPayableAmountPaise",
  "paidAmountPaise",
  "commissionAmountPaise",
  "sellerPayoutAmountPaise",
  "transportChargePaise",
] as const;

const serviceBookingMoneyFields = ["totalPayablePaise", "paidAmountPaise"] as const;
const sellerPayoutMoneyFields = ["grossSalesPaise", "commissionPaise", "adjustmentPaise", "netPayablePaise"] as const;
const sellerLedgerMoneyFields = ["debitPaise", "creditPaise", "balanceAfterPaise"] as const;

@Injectable()
export class ReportsService {
  private readonly gstCompliance: GstComplianceService;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FinanceCalculatorService) private readonly financeCalculator: FinanceCalculatorService,
    @Inject(MarketService) private readonly marketService: MarketService,
    @Inject(GstComplianceService) gstCompliance?: GstComplianceService,
  ) {
    this.gstCompliance =
      gstCompliance ?? new GstComplianceService(prisma, financeCalculator);
  }

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

  operationalPage(exportType: ReportExportType, query: OperationalReportQueryDto) {
    return reportExportTablePage(
      this.prisma.client,
      exportType,
      {
        ...(query.dateFrom ? { dateFrom: query.dateFrom } : {}),
        ...(query.dateTo ? { dateTo: query.dateTo } : {}),
        ...(query.search?.trim() ? { search: query.search.trim() } : {}),
        ...(query.status?.trim() ? { status: query.status.trim() } : {}),
      },
      query.page,
      query.limit,
    );
  }

  async sellerSales(actor: RequestUser, query: ReportQueryDto) {
    const seller = await this.prisma.client.seller.findUnique({
      where: { userId: actor.id },
      include: {
        addresses: {
          select: { countryCode: true },
          orderBy: { createdAt: "asc" },
          take: 1
        }
      }
    });

    if (!seller) {
      throw new ForbiddenException("Seller account is required.");
    }
    const market = await this.marketForSeller(seller);

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
      calculatedSplitFinance,
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
              customer: { include: { user: true } },
              items: {
                include: {
                  product: true
                }
              }
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
      const unstampedFinanceSplits = await tx.orderSellerSplit.findMany({
        where: {
          ...splitWhere,
          sellerSubtotalPaise: { gt: 0 },
          commissionPaise: 0,
          gstOnCommissionPaise: 0,
          tdsPaise: 0,
          tcsPaise: 0,
          platformFeePaise: 0
        },
        include: {
          order: {
            include: {
              items: {
                include: {
                  product: true
                }
              }
            }
          }
        }
      });
      const calculatedSplitFinance = [];
      for (const split of unstampedFinanceSplits) {
        const calculation = await this.financeCalculator.calculateSplit(split, tx);
        calculatedSplitFinance.push({
          splitId: split.id,
          commissionPaise: calculation.commissionPaise,
          gstOnCommissionPaise: calculation.gstOnCommissionPaise,
          tdsPaise: calculation.tdsPaise,
          tcsPaise: calculation.tcsPaise,
          platformFeePaise: calculation.platformFeePaise,
          netPayablePaise: calculation.netPayablePaise,
          storedCommissionPaise: split.commissionPaise,
          storedGstOnCommissionPaise: split.gstOnCommissionPaise,
          storedTdsPaise: split.tdsPaise,
          storedTcsPaise: split.tcsPaise,
          storedPlatformFeePaise: split.platformFeePaise
        });
      }

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
        calculatedSplitFinance,
      ] as const;
    });

    const calculatedFinanceBySplitId = new Map(
      calculatedSplitFinance.map((item) => [item.splitId, item])
    );
    const commissionPaise =
      (summary._sum.commissionPaise ?? 0) +
      calculatedSplitFinance.reduce(
        (total, item) => total + item.commissionPaise - item.storedCommissionPaise,
        0,
      );
    const gstOnCommissionPaise =
      (summary._sum.gstOnCommissionPaise ?? 0) +
      calculatedSplitFinance.reduce(
        (total, item) => total + item.gstOnCommissionPaise - item.storedGstOnCommissionPaise,
        0,
      );
    const tdsPaise =
      (summary._sum.tdsPaise ?? 0) +
      calculatedSplitFinance.reduce(
        (total, item) => total + item.tdsPaise - item.storedTdsPaise,
        0,
      );
    const tcsPaise =
      (summary._sum.tcsPaise ?? 0) +
      calculatedSplitFinance.reduce(
        (total, item) => total + item.tcsPaise - item.storedTcsPaise,
        0,
      );
    const platformFeePaise =
      (summary._sum.platformFeePaise ?? 0) +
      calculatedSplitFinance.reduce(
        (total, item) => total + item.platformFeePaise - item.storedPlatformFeePaise,
        0,
      );
    const totalSalesPaise = summary._sum.sellerSubtotalPaise ?? 0;
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
      currency: market.currency,
      baseCurrency: market.baseCurrency,
      fxRate: market.rate,
      seller: {
        id: seller.id,
        primaryCapability: seller.primaryCapability,
        enabledCapabilities: seller.enabledCapabilities
      },
      summary: this.convertMoneyFields({
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
      }, sellerSalesSummaryMoneyFields, market),
      b2b: {
        enquiryCount: b2bEnquiries,
        orderCount: b2bOrders._count,
        ...this.convertMoneyFields({
          subtotalPaise: b2bOrders._sum.subtotalPaise ?? 0,
          buyerPayablePaise: b2bOrders._sum.buyerPayableAmountPaise ?? 0,
          paidAmountPaise: b2bOrders._sum.paidAmountPaise ?? 0,
          commissionPaise: b2bOrders._sum.commissionAmountPaise ?? 0,
          sellerPayoutPaise: b2bOrders._sum.sellerPayoutAmountPaise ?? 0,
        }, ["subtotalPaise", "buyerPayablePaise", "paidAmountPaise", "commissionPaise", "sellerPayoutPaise"] as const, market),
        byEnquiryStatus: b2bEnquiriesByStatus.map((item) => ({
          status: item.status,
          count: item._count
        })),
        byOrderStatus: b2bOrdersByStatus.map((item) => this.convertMoneyFields({
          status: item.status,
          count: item._count,
          buyerPayablePaise: item._sum.buyerPayableAmountPaise ?? 0,
          sellerPayoutPaise: item._sum.sellerPayoutAmountPaise ?? 0
        }, ["buyerPayablePaise", "sellerPayoutPaise"] as const, market)),
        byPaymentStatus: b2bOrdersByPaymentStatus.map((item) => this.convertMoneyFields({
          status: item.paymentStatus,
          count: item._count,
          paidAmountPaise: item._sum.paidAmountPaise ?? 0,
          buyerPayablePaise: item._sum.buyerPayableAmountPaise ?? 0
        }, ["paidAmountPaise", "buyerPayablePaise"] as const, market)),
        recentOrders: recentB2BOrders.map((order) => this.convertCurrencyRecord(order, b2bOrderMoneyFields, market))
      },
      services: {
        listingCount: serviceListings,
        activeListingCount: activeServiceListings,
        bookingCount: serviceBookings._count,
        ...this.convertMoneyFields({
          totalPayablePaise: serviceBookings._sum.totalPayablePaise ?? 0,
          paidAmountPaise: serviceBookings._sum.paidAmountPaise ?? 0,
          paidPaymentPaise: servicePayments._sum.amountPaise ?? 0,
        }, ["totalPayablePaise", "paidAmountPaise", "paidPaymentPaise"] as const, market),
        paidPaymentCount: servicePayments._count,
        byBookingStatus: serviceBookingsByStatus.map((item) => this.convertMoneyFields({
          status: item.status,
          count: item._count,
          totalPayablePaise: item._sum.totalPayablePaise ?? 0,
          paidAmountPaise: item._sum.paidAmountPaise ?? 0
        }, ["totalPayablePaise", "paidAmountPaise"] as const, market)),
        byPaymentStatus: servicePaymentsByStatus.map((item) => this.convertMoneyFields({
          status: item.status,
          count: item._count,
          amountPaise: item._sum.amountPaise ?? 0
        }, ["amountPaise"] as const, market)),
        recentBookings: recentServiceBookings.map((booking) => this.convertCurrencyRecord(booking, serviceBookingMoneyFields, market))
      },
      recentOrders: splits.map((split) => {
        const calculated = calculatedFinanceBySplitId.get(split.id);
        const effectiveSplit = calculated
          ? {
              ...split,
              commissionPaise: calculated.commissionPaise,
              gstOnCommissionPaise: calculated.gstOnCommissionPaise,
              tdsPaise: calculated.tdsPaise,
              tcsPaise: calculated.tcsPaise,
              platformFeePaise: calculated.platformFeePaise,
              netPayablePaise: calculated.netPayablePaise,
            }
          : split;

        return this.convertSellerSplitRecord(effectiveSplit, market);
      }),
      lowStockProducts
    };
  }

  async sellerReportsOverview(actor: RequestUser, query: ReportQueryDto) {
    const seller = await this.requireSeller(actor);
    const market = await this.marketForSeller(seller);
    const createdAt = this.dateRange(query);
    const splitWhere: Prisma.OrderSellerSplitWhereInput = { sellerId: seller.id, order: this.reportableOrderWhere(createdAt) };
    const b2bWhere: Prisma.B2BOrderWhereInput = { sellerId: seller.id, status: { not: B2BOrderStatus.CANCELLED }, ...(createdAt ? { createdAt } : {}) };
    const returnWhere: Prisma.ReturnRequestWhereInput = { items: { some: { sellerId: seller.id } }, ...(createdAt ? { createdAt } : {}) };
    const [splitAgg, payoutAgg, lowStockCount, productCount, b2bCount, returnCount] = await this.prisma.client.$transaction(async (tx) => {
      const splitAgg = await this.effectiveSellerSplitFinance(tx, splitWhere);
      const payoutAgg = await tx.sellerPayout.aggregate({ where: { sellerId: seller.id, status: SellerPayoutStatus.PAID }, _sum: { netPayablePaise: true }, _count: true });
      const lowStockCount = await tx.productVariant.count({ where: { stockQuantity: { lte: 5 }, product: { sellerId: seller.id, deletedAt: null } } });
      const productCount = await tx.product.count({ where: { sellerId: seller.id, deletedAt: null } });
      const b2bCount = await tx.b2BOrder.count({ where: b2bWhere });
      const returnCount = await tx.returnRequest.count({ where: returnWhere });
      return [splitAgg, payoutAgg, lowStockCount, productCount, b2bCount, returnCount] as const;
    });
    // Re-derive net sales from effective components (matches finance-calculator formula exactly)
    const netSalesPaise =
      splitAgg.sellerSubtotalPaise -
      splitAgg.commissionPaise -
      splitAgg.gstOnCommissionPaise -
      splitAgg.tdsPaise -
      splitAgg.tcsPaise -
      splitAgg.platformFeePaise -
      splitAgg.couponSellerFundedDiscountPaise +
      splitAgg.couponAdjustmentPaise +
      splitAgg.refundAdjustmentPaise;
    // Total deductions includes coupon seller-funded discounts
    const totalDeductionsPaise =
      splitAgg.commissionPaise +
      splitAgg.gstOnCommissionPaise +
      splitAgg.tdsPaise +
      splitAgg.tcsPaise +
      splitAgg.platformFeePaise +
      splitAgg.couponSellerFundedDiscountPaise;
    return {
      currency: market.currency,
      baseCurrency: market.baseCurrency,
      fxRate: market.rate,
      ...this.convertMoneyFields({
        totalSalesPaise: splitAgg.sellerSubtotalPaise,
        netSalesPaise,
        commissionPaise: splitAgg.commissionPaise,
        gstOnCommissionPaise: splitAgg.gstOnCommissionPaise,
        tdsPaise: splitAgg.tdsPaise,
        tcsPaise: splitAgg.tcsPaise,
        totalDeductionsPaise,
        paidPayoutsPaise: payoutAgg._sum.netPayablePaise ?? 0,
      }, ["totalSalesPaise", "netSalesPaise", "commissionPaise", "gstOnCommissionPaise", "tdsPaise", "tcsPaise", "totalDeductionsPaise", "paidPayoutsPaise"] as const, market),
      orderCount: splitAgg.count,
      products: productCount,
      lowStockCount,
      paidPayoutsCount: payoutAgg._count,
      b2bOrderCount: b2bCount,
      returnCount
    };
  }

  async sellerInventoryReport(actor: RequestUser, query: ReportQueryDto) {
    const seller = await this.requireSeller(actor);
    const market = await this.marketForSeller(seller);
    const createdAt = this.dateRange(query);
    const splitWhere: Prisma.OrderSellerSplitWhereInput = { sellerId: seller.id, order: this.reportableOrderWhere(createdAt) };
    const variantWhere: Prisma.ProductVariantWhereInput = { product: { sellerId: seller.id, deletedAt: null } };
    const [productCount, activeProductCount, variantCount, lowStockCount, lowStockVariants, allVariants, topSoldItems] = await this.prisma.client.$transaction(async (tx) => {
      const productCount = await tx.product.count({ where: { sellerId: seller.id, deletedAt: null } });
      const activeProductCount = await tx.product.count({ where: { sellerId: seller.id, status: ProductStatus.ACTIVE, deletedAt: null } });
      const variantCount = await tx.productVariant.count({ where: variantWhere });
      const lowStockCount = await tx.productVariant.count({ where: { ...variantWhere, stockQuantity: { lte: 5 } } });
      const lowStockVariants = await tx.productVariant.findMany({ where: { ...variantWhere, stockQuantity: { lte: 5 } }, include: { product: { select: { id: true, name: true, status: true } } }, orderBy: { stockQuantity: "asc" }, take: 50 });
      const allVariants = await tx.productVariant.findMany({ where: variantWhere, include: { product: { select: { id: true, name: true, status: true } } }, orderBy: { stockQuantity: "asc" }, take: 100 });
      const topSoldItems = await tx.orderItem.groupBy({ by: ["productId"], where: { sellerId: seller.id, order: this.reportableOrderWhere(createdAt) }, _sum: { quantity: true, lineTotalPaise: true }, orderBy: { _sum: { quantity: "desc" } }, take: 10 });
      return [productCount, activeProductCount, variantCount, lowStockCount, lowStockVariants, allVariants, topSoldItems] as const;
    });
    const products = await this.prisma.client.product.findMany({ where: { id: { in: topSoldItems.map((i) => i.productId) }, sellerId: seller.id }, select: { id: true, name: true } });
    const productNameMap = new Map(products.map((p) => [p.id, p.name]));
    const splits = await this.prisma.client.orderSellerSplit.findMany({ where: splitWhere, select: { id: true, sellerSubtotalPaise: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 10 });
    return {
      currency: market.currency,
      baseCurrency: market.baseCurrency,
      fxRate: market.rate,
      summary: { productCount, activeProductCount, variantCount, lowStockCount },
      splits: splits.map((split) => this.convertMoneyFields(split, ["sellerSubtotalPaise"] as const, market)),
      lowStockVariants,
      variants: allVariants,
      topSoldItems: topSoldItems.map((i) => this.convertMoneyFields({
        productId: i.productId,
        productName: productNameMap.get(i.productId) ?? "Product",
        quantitySold: i._sum.quantity ?? 0,
        revenuePaise: i._sum.lineTotalPaise ?? 0
      }, ["revenuePaise"] as const, market))
    };
  }

  async sellerFinanceReport(actor: RequestUser, query: ReportQueryDto) {
    const seller = await this.requireSeller(actor);
    const market = await this.marketForSeller(seller);
    const createdAt = this.dateRange(query);
    const splitWhere: Prisma.OrderSellerSplitWhereInput = { sellerId: seller.id, order: this.reportableOrderWhere(createdAt) };
    const payoutDateWhere = createdAt ? { createdAt } : {};
    const [splitAgg, eligibleSplits, pendingPayouts, paidPayouts, recentPayouts, ledgerEntries] = await this.prisma.client.$transaction(async (tx) => {
      const splitAgg = await this.effectiveSellerSplitFinance(tx, splitWhere);
      const eligibleSplits = await this.effectiveSellerSplitFinance(tx, {
        sellerId: seller.id,
        settlementStatus: SellerSettlementStatus.ELIGIBLE,
        payoutId: null,
        order: this.reportableOrderWhere(createdAt),
      });
      const pendingPayouts = await tx.sellerPayout.aggregate({ where: { sellerId: seller.id, status: { in: [SellerPayoutStatus.PENDING_APPROVAL, SellerPayoutStatus.APPROVED] }, ...payoutDateWhere }, _sum: { netPayablePaise: true }, _count: true });
      const paidPayouts = await tx.sellerPayout.aggregate({ where: { sellerId: seller.id, status: SellerPayoutStatus.PAID, ...payoutDateWhere }, _sum: { netPayablePaise: true, grossSalesPaise: true }, _count: true });
      const recentPayouts = await tx.sellerPayout.findMany({ where: { sellerId: seller.id, ...payoutDateWhere }, orderBy: { createdAt: "desc" }, take: 20 });
      const ledgerEntries = await tx.sellerLedgerEntry.findMany({ where: { sellerId: seller.id, ...(createdAt ? { createdAt } : {}) }, orderBy: { createdAt: "desc" }, take: 20 });
      return [splitAgg, eligibleSplits, pendingPayouts, paidPayouts, recentPayouts, ledgerEntries] as const;
    });
    // Re-derive net payable from effective components (matches finance-calculator formula exactly)
    const financeNetPayablePaise =
      splitAgg.sellerSubtotalPaise -
      splitAgg.commissionPaise -
      splitAgg.gstOnCommissionPaise -
      splitAgg.tdsPaise -
      splitAgg.tcsPaise -
      splitAgg.platformFeePaise -
      splitAgg.couponSellerFundedDiscountPaise +
      splitAgg.couponAdjustmentPaise +
      splitAgg.refundAdjustmentPaise;
    return {
      currency: market.currency,
      baseCurrency: market.baseCurrency,
      fxRate: market.rate,
      summary: this.convertMoneyFields({ grossSalesPaise: splitAgg.sellerSubtotalPaise, commissionPaise: splitAgg.commissionPaise, gstOnCommissionPaise: splitAgg.gstOnCommissionPaise, tdsPaise: splitAgg.tdsPaise, tcsPaise: splitAgg.tcsPaise, netPayablePaise: financeNetPayablePaise, refundAdjustmentPaise: splitAgg.refundAdjustmentPaise, platformFeePaise: splitAgg.platformFeePaise, couponDiscountPaise: splitAgg.couponSellerFundedDiscountPaise, orderCount: splitAgg.count, pendingPayoutsPaise: pendingPayouts._sum.netPayablePaise ?? 0, pendingPayoutsCount: pendingPayouts._count, paidPayoutsPaise: paidPayouts._sum.netPayablePaise ?? 0, paidPayoutsCount: paidPayouts._count, eligiblePaise: eligibleSplits.netPayablePaise, eligibleCount: eligibleSplits.count }, ["grossSalesPaise", "commissionPaise", "gstOnCommissionPaise", "tdsPaise", "tcsPaise", "netPayablePaise", "refundAdjustmentPaise", "platformFeePaise", "couponDiscountPaise", "pendingPayoutsPaise", "paidPayoutsPaise", "eligiblePaise"] as const, market),
      recentPayouts: recentPayouts.map((payout) => this.convertCurrencyRecord(payout, sellerPayoutMoneyFields, market)),
      ledgerEntries: ledgerEntries.map((entry) => this.convertCurrencyRecord(entry, sellerLedgerMoneyFields, market))
    };
  }

  async sellerTaxReport(actor: RequestUser, query: ReportQueryDto) {
    const seller = await this.requireSeller(actor);
    const market = await this.marketForSeller(seller);
    const createdAt = this.dateRange(query);
    const splitWhere: Prisma.OrderSellerSplitWhereInput = { sellerId: seller.id, order: this.reportableOrderWhere(createdAt) };
    const [taxAgg, splits] = await this.prisma.client.$transaction(async (tx) => {
      const taxAgg = await this.effectiveSellerSplitFinance(tx, splitWhere);
      const splits = await tx.orderSellerSplit.findMany({ where: splitWhere, include: { order: { select: { orderNumber: true, createdAt: true, currency: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
      const calculatedSplits = await this.applyEffectiveFinanceToSplits(tx, splits);
      return [taxAgg, calculatedSplits] as const;
    });
    // Re-derive net payable from effective components (matches finance-calculator formula exactly)
    const netPayablePaise =
      taxAgg.sellerSubtotalPaise -
      taxAgg.commissionPaise -
      taxAgg.gstOnCommissionPaise -
      taxAgg.tdsPaise -
      taxAgg.tcsPaise -
      taxAgg.platformFeePaise -
      taxAgg.couponSellerFundedDiscountPaise +
      taxAgg.couponAdjustmentPaise +
      taxAgg.refundAdjustmentPaise;
    // Total deductions includes coupon seller-funded discounts
    const totalDeductionsPaise =
      taxAgg.commissionPaise +
      taxAgg.gstOnCommissionPaise +
      taxAgg.tdsPaise +
      taxAgg.tcsPaise +
      taxAgg.platformFeePaise +
      taxAgg.couponSellerFundedDiscountPaise;
    return {
      currency: market.currency,
      baseCurrency: market.baseCurrency,
      fxRate: market.rate,
      summary: this.convertMoneyFields({ orderCount: taxAgg.count, grossSalesPaise: taxAgg.sellerSubtotalPaise, commissionPaise: taxAgg.commissionPaise, gstOnCommissionPaise: taxAgg.gstOnCommissionPaise, tdsPaise: taxAgg.tdsPaise, tcsPaise: taxAgg.tcsPaise, platformFeePaise: taxAgg.platformFeePaise, couponDiscountPaise: taxAgg.couponSellerFundedDiscountPaise, netPayablePaise, totalDeductionsPaise }, ["grossSalesPaise", "commissionPaise", "gstOnCommissionPaise", "tdsPaise", "tcsPaise", "platformFeePaise", "couponDiscountPaise", "netPayablePaise", "totalDeductionsPaise"] as const, market),
      splits: splits.map((split) => this.convertSellerSplitRecord(split, market))
    };
  }

  async sellerGstReport(actor: RequestUser, query: ReportQueryDto, includeAll = false) {
    const seller = await this.requireSeller(actor);
    return this.gstCompliance.report(query, seller.id, includeAll);
  }

  async adminGstReport(query: AdminGstReportQueryDto, includeAll = false) {
    return this.gstCompliance.report(query, query.sellerId, includeAll);
  }

  async sellerReturnsReport(actor: RequestUser, query: ReportQueryDto) {
    const seller = await this.requireSeller(actor);
    const market = await this.marketForSeller(seller);
    const createdAt = this.dateRange(query);
    const returnItemWhere: Prisma.ReturnRequestItemWhereInput = {
      sellerId: seller.id,
      ...(createdAt ? { returnRequest: { createdAt } } : {})
    };
    const returnWhere: Prisma.ReturnRequestWhereInput = { items: { some: { sellerId: seller.id } }, ...(createdAt ? { createdAt } : {}) };
    const [requestTotals, recentReturns] = await this.prisma.client.$transaction(async (tx) => {
      const itemTotals = await tx.returnRequestItem.groupBy({
        by: ["returnRequestId"],
        where: returnItemWhere,
        _count: true,
        _sum: { requestedRefundPaise: true, approvedRefundPaise: true }
      });
      const requestStatuses = itemTotals.length
        ? await tx.returnRequest.findMany({
            where: { id: { in: itemTotals.map((item) => item.returnRequestId) } },
            select: { id: true, status: true }
          })
        : [];
      const statusByRequestId = new Map(requestStatuses.map((item) => [item.id, item.status]));
      const requestTotals = itemTotals.map((item) => ({
        ...item,
        status: statusByRequestId.get(item.returnRequestId) ?? ReturnRequestStatus.PENDING_REVIEW
      }));
      const recentReturns = await tx.returnRequest.findMany({
        where: returnWhere,
        include: {
          order: { select: { orderNumber: true } },
          items: {
            where: { sellerId: seller.id },
            select: {
              requestedRefundPaise: true,
              approvedRefundPaise: true
            }
          }
        },
        orderBy: { requestedAt: "desc" },
        take: 50
      });
      return [requestTotals, recentReturns] as const;
    });
    const byStatusMap = new Map<ReturnRequestStatus, { count: number; requestedAmountPaise: number; approvedAmountPaise: number }>();
    for (const request of requestTotals) {
      const current = byStatusMap.get(request.status) ?? { count: 0, requestedAmountPaise: 0, approvedAmountPaise: 0 };
      current.count += 1;
      current.requestedAmountPaise += request._sum.requestedRefundPaise ?? 0;
      current.approvedAmountPaise += request._sum.approvedRefundPaise ?? 0;
      byStatusMap.set(request.status, current);
    }
    const approvedCount = byStatusMap.get(ReturnRequestStatus.APPROVED)?.count ?? 0;
    const pendingCount = byStatusMap.get(ReturnRequestStatus.PENDING_REVIEW)?.count ?? 0;
    const requestedAmountPaise = requestTotals.reduce((sum, item) => sum + (item._sum.requestedRefundPaise ?? 0), 0);
    const approvedAmountPaise = requestTotals.reduce((sum, item) => sum + (item._sum.approvedRefundPaise ?? 0), 0);
    const itemCount = requestTotals.reduce((sum, item) => sum + item._count, 0);
    return {
      currency: market.currency,
      baseCurrency: market.baseCurrency,
      fxRate: market.rate,
      summary: this.convertMoneyFields({
        totalCount: requestTotals.length,
        approvedCount,
        pendingCount,
        requestedAmountPaise,
        approvedAmountPaise,
        itemCount
      }, ["requestedAmountPaise", "approvedAmountPaise"] as const, market),
      byStatus: Array.from(byStatusMap.entries()).map(([status, item]) =>
        this.convertMoneyFields({ status, ...item }, ["requestedAmountPaise", "approvedAmountPaise"] as const, market)
      ),
      recentReturns: recentReturns.map(({ items, ...request }) => this.convertMoneyFields({
        ...request,
        requestedAmountPaise: items.reduce((sum, item) => sum + item.requestedRefundPaise, 0),
        approvedAmountPaise: items.reduce((sum, item) => sum + item.approvedRefundPaise, 0)
      }, ["requestedAmountPaise", "approvedAmountPaise"] as const, market))
    };
  }

  private async requireSeller(actor: RequestUser) {
    const seller = await this.prisma.client.seller.findUnique({
      where: { userId: actor.id },
      include: {
        addresses: {
          select: { countryCode: true },
          orderBy: { createdAt: "asc" },
          take: 1
        }
      }
    });
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

  private async effectiveSellerSplitFinance(
    tx: Prisma.TransactionClient,
    splitWhere: Prisma.OrderSellerSplitWhereInput,
  ) {
    const aggregate = await tx.orderSellerSplit.aggregate({
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
        refundAdjustmentPaise: true,
        netPayablePaise: true
      }
    });
    const unstampedSplits = await this.findUnstampedFinanceSplits(tx, splitWhere);
    const totals = {
      count: aggregate._count,
      sellerSubtotalPaise: aggregate._sum.sellerSubtotalPaise ?? 0,
      commissionPaise: aggregate._sum.commissionPaise ?? 0,
      gstOnCommissionPaise: aggregate._sum.gstOnCommissionPaise ?? 0,
      tdsPaise: aggregate._sum.tdsPaise ?? 0,
      tcsPaise: aggregate._sum.tcsPaise ?? 0,
      platformFeePaise: aggregate._sum.platformFeePaise ?? 0,
      couponSellerFundedDiscountPaise: aggregate._sum.couponSellerFundedDiscountPaise ?? 0,
      couponAdjustmentPaise: aggregate._sum.couponAdjustmentPaise ?? 0,
      refundAdjustmentPaise: aggregate._sum.refundAdjustmentPaise ?? 0,
      netPayablePaise: aggregate._sum.netPayablePaise ?? 0
    };

    for (const split of unstampedSplits) {
      const calculation = await this.financeCalculator.calculateSplit(split, tx);
      totals.commissionPaise += calculation.commissionPaise - split.commissionPaise;
      totals.gstOnCommissionPaise += calculation.gstOnCommissionPaise - split.gstOnCommissionPaise;
      totals.tdsPaise += calculation.tdsPaise - split.tdsPaise;
      totals.tcsPaise += calculation.tcsPaise - split.tcsPaise;
      totals.platformFeePaise += calculation.platformFeePaise - split.platformFeePaise;
      totals.netPayablePaise += calculation.netPayablePaise - split.netPayablePaise;
    }

    return totals;
  }

  private async findUnstampedFinanceSplits(
    tx: Prisma.TransactionClient,
    splitWhere: Prisma.OrderSellerSplitWhereInput,
  ) {
    return tx.orderSellerSplit.findMany({
      where: {
        ...splitWhere,
        sellerSubtotalPaise: { gt: 0 },
        commissionPaise: 0,
        gstOnCommissionPaise: 0,
        tdsPaise: 0,
        tcsPaise: 0,
        platformFeePaise: 0
      },
      include: {
        order: {
          include: {
            items: {
              include: {
                product: true
              }
            }
          }
        }
      }
    });
  }

  private async applyEffectiveFinanceToSplits<T extends { id: string }>(
    tx: Prisma.TransactionClient,
    splits: T[],
  ) {
    const unstampedIds = splits
      .filter((split) => {
        const finance = split as T & {
          sellerSubtotalPaise?: number;
          commissionPaise?: number;
          gstOnCommissionPaise?: number;
          tdsPaise?: number;
          tcsPaise?: number;
          platformFeePaise?: number;
        };
        return (
          (finance.sellerSubtotalPaise ?? 0) > 0 &&
          (finance.commissionPaise ?? 0) === 0 &&
          (finance.gstOnCommissionPaise ?? 0) === 0 &&
          (finance.tdsPaise ?? 0) === 0 &&
          (finance.tcsPaise ?? 0) === 0 &&
          (finance.platformFeePaise ?? 0) === 0
        );
      })
      .map((split) => split.id);
    if (unstampedIds.length === 0) {
      return splits;
    }

    const financeSplits = await this.findUnstampedFinanceSplits(tx, { id: { in: unstampedIds } });
    const calculatedById = new Map<string, Awaited<ReturnType<FinanceCalculatorService["calculateSplit"]>>>();
    for (const split of financeSplits) {
      calculatedById.set(split.id, await this.financeCalculator.calculateSplit(split, tx));
    }

    return splits.map((split) => {
      const calculated = calculatedById.get(split.id);
      return calculated
        ? {
            ...split,
            commissionPaise: calculated.commissionPaise,
            gstOnCommissionPaise: calculated.gstOnCommissionPaise,
            tdsPaise: calculated.tdsPaise,
            tcsPaise: calculated.tcsPaise,
            platformFeePaise: calculated.platformFeePaise,
            netPayablePaise: calculated.netPayablePaise,
          }
        : split;
    });
  }

  private async marketForSeller(seller: { addresses?: Array<{ countryCode?: string | null }> }) {
    const countryCode = seller.addresses?.[0]?.countryCode?.trim().toUpperCase() || "IN";
    return this.marketService.getMarketCurrency(countryCode, { requireFresh: true, forceRefresh: true });
  }

  private convertMoneyFields<T extends Record<string, unknown>, K extends readonly string[]>(
    record: T,
    fields: K,
    market: MarketCurrencySnapshot,
  ) {
    const converted: Record<string, unknown> = { ...record };
    for (const field of fields) {
      const value = converted[field];
      if (typeof value === "number") {
        converted[field] = this.marketService.convertMinorUnits(value, market);
      }
    }

    return converted as T;
  }

  private convertCurrencyRecord<T extends Record<string, unknown>, K extends readonly string[]>(
    record: T,
    fields: K,
    market: MarketCurrencySnapshot,
  ) {
    return {
      ...this.convertMoneyFields(record, fields, market),
      currency: market.currency,
    };
  }

  private convertSellerSplitRecord<T extends Record<string, unknown> & { order?: Record<string, unknown> | null }>(
    split: T,
    market: MarketCurrencySnapshot,
  ) {
    return {
      ...this.convertMoneyFields(split, sellerSplitMoneyFields, market),
      order: split.order
        ? {
            ...split.order,
            currency: market.currency,
          }
        : split.order,
    };
  }
}
