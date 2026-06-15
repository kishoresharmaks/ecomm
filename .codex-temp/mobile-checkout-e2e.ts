import { prisma } from "@indihub/database";

const apiBaseUrl = "http://192.168.1.3:4000/api";

async function main() {
  const runId = `codex-checkout-${Date.now()}`;
  const role = await prisma.role.findUniqueOrThrow({ where: { code: "CUSTOMER" } });
  const variant = await prisma.productVariant.findFirstOrThrow({
    where: {
      status: "ACTIVE",
      stockQuantity: { gt: 3 },
      product: {
        status: "ACTIVE",
        approvalStatus: "APPROVED",
        deletedAt: null,
        seller: {
          status: "APPROVED",
          approvalStatus: "APPROVED",
        },
      },
    },
    select: {
      id: true,
      stockQuantity: true,
      product: {
        select: {
          name: true,
          slug: true,
          seller: { select: { storeName: true } },
        },
      },
    },
  });

  const user = await prisma.user.create({
    data: {
      email: `${runId}@example.test`,
      fullName: "Codex Checkout Test",
      userRoles: { create: { roleId: role.id } },
      customer: {
        create: {
          displayName: "Codex Checkout Test",
          addresses: {
            create: {
              label: "Test delivery",
              fullName: "Codex Checkout Test",
              phone: "9876543210",
              line1: "Test address line",
              area: "Mettu Street",
              city: "Salem",
              state: "Tamil Nadu",
              pincode: "636001",
              country: "India",
              countryCode: "IN",
              isDefault: true,
            },
          },
        },
      },
    },
    include: {
      customer: {
        include: { addresses: true },
      },
    },
  });

  const headers = {
    "content-type": "application/json",
    "x-indihub-user-id": user.id,
  };
  const address = user.customer?.addresses[0];
  if (!address) {
    throw new Error("Test customer address was not created.");
  }

  const addCart = await request("/cart/items", {
    method: "POST",
    headers,
    body: JSON.stringify({ productVariantId: variant.id, quantity: 2 }),
  });
  const cart = await request("/cart", { headers });
  const summary = await request(
    `/cart/checkout-summary?buyerCountryCode=IN&deliveryPreference=DELIVER_TO_ADDRESS&paymentMethod=COD&addressId=${address.id}`,
    { headers },
  );
  const order = await request("/account/orders", {
    method: "POST",
    headers,
    body: JSON.stringify({
      buyerCountryCode: "IN",
      deliveryPreference: "DELIVER_TO_ADDRESS",
      paymentMethod: "COD",
      addressId: address.id,
      customerNote: `Codex E2E ${runId}`,
    }),
  });
  const orders = await request("/account/orders?limit=5", { headers });
  const cartAfterOrder = await request("/cart", { headers });

  console.log(
    JSON.stringify(
      {
        runId,
        userId: user.id,
        product: {
          name: variant.product.name,
          slug: variant.product.slug,
          seller: variant.product.seller.storeName,
        },
        before: {
          addCartItems: addCart.items?.length,
          cartItems: cart.items?.length,
          summaryItems: summary.itemCount,
          summaryTotalPaise: summary.totalPaise,
        },
        order: {
          orderNumber: order.orderNumber,
          itemCount: order.items?.length,
          totalPaise: order.totalPaise,
          paymentStatus: order.paymentStatus,
          deliveryStatus: order.deliveryStatus,
        },
        after: {
          ordersReturned: orders.items?.length,
          latestOrderNumber: orders.items?.[0]?.orderNumber,
          activeCartItems: cartAfterOrder.items?.length,
        },
      },
      null,
      2,
    ),
  );
}

async function request(path: string, init: RequestInit) {
  const response = await fetch(`${apiBaseUrl}${path}`, init);
  const text = await response.text();
  let body: any = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${path}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }

  return body;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
