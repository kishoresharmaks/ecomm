import type { IconSvgElement } from "@hugeicons/react-native";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { StarIcon } from "@hugeicons/core-free-icons";
import { View, Text, type StyleProp, type ViewStyle } from "react-native";

export type RatingDisplaySize = "small" | "medium" | "large";

interface RatingDisplayProps {
  averageRating?: number | null;
  reviewCount?: number;
  size?: RatingDisplaySize;
  style?: StyleProp<ViewStyle>;
}

const SIZE_MAP: Record<RatingDisplaySize, { starSize: number; fontSize: number; gap: number }> = {
  small: { starSize: 14, fontSize: 11, gap: 4 },
  medium: { starSize: 18, fontSize: 12, gap: 6 },
  large: { starSize: 22, fontSize: 14, gap: 8 },
};

export function RatingDisplay({
  averageRating,
  reviewCount,
  size = "medium",
  style,
}: RatingDisplayProps) {
  if (averageRating == null && (!reviewCount || reviewCount === 0)) {
    return null;
  }

  const { starSize, fontSize, gap } = SIZE_MAP[size];
  const displayRating = averageRating ?? 0;
  const stars = buildStarSegments(displayRating);

  return (
    <View style={[styles.row, style, { gap }]}>
      <View style={styles.starsRow}>
        {stars.map((filled, index) => (
          <HugeiconsIcon
            key={index}
            icon={StarIcon}
            size={starSize}
            color={filled ? "#F59E0B" : "#D1D5DB"}
            strokeWidth={filled ? 1.8 : 1.4}
          />
        ))}
      </View>
      {reviewCount != null && reviewCount > 0 && (
        <Text style={[styles.count, { fontSize }]}>
          {displayRating.toFixed(1)} ({reviewCount})
        </Text>
      )}
    </View>
  );
}

function buildStarSegments(rating: number): boolean[] {
  const stars: boolean[] = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(rating >= i);
  }
  return stars;
}

const styles = {
  row: {
    alignItems: "center" as const,
    flexDirection: "row" as const,
  },
  starsRow: {
    alignItems: "center" as const,
    flexDirection: "row" as const,
  },
  count: {
    color: "#6B7280",
    fontWeight: "800" as const,
  },
};
