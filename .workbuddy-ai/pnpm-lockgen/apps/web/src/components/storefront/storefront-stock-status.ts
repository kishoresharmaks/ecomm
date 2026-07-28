export type StorefrontStockTone = "success" | "warning" | "danger" | "neutral";

export type StorefrontStockStatus = {
  label: string;
  tone: StorefrontStockTone;
  isAvailable: boolean;
};

export function getStorefrontStockStatus(stockQuantity: number | null | undefined): StorefrontStockStatus {
  if (typeof stockQuantity !== "number" || !Number.isFinite(stockQuantity)) {
    return {
      label: "Availability pending",
      tone: "neutral",
      isAvailable: false,
    };
  }

  if (stockQuantity <= 0) {
    return {
      label: "Out of stock",
      tone: "danger",
      isAvailable: false,
    };
  }

  if (stockQuantity < 10) {
    return {
      label: "Few left",
      tone: "warning",
      isAvailable: true,
    };
  }

  return {
    label: "In stock",
    tone: "success",
    isAvailable: true,
  };
}

export function storefrontStockBadgeClass(tone: StorefrontStockTone) {
  switch (tone) {
    case "success":
      return "bg-[#ECFDF3] text-[#087443]";
    case "warning":
      return "bg-[#FFF7E6] text-[#B54708]";
    case "danger":
      return "bg-[#FFF0EC] text-[#C4320A]";
    default:
      return "bg-[#F2F4F7] text-[#667085]";
  }
}
