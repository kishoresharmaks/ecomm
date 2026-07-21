import { Pressable, Text, View } from "react-native";
import { RETURN_REASON_OPTIONS } from "../features/seller/product-edit";
import { colors, spacing } from "../theme";

export function ReturnReasonSelector({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
}) {
  const selected = new Set(
    value
      .split(",")
      .map((reason) => reason.trim())
      .filter(Boolean),
  );

  function toggle(reason: string) {
    const next = new Set(selected);
    if (next.has(reason)) {
      next.delete(reason);
    } else {
      next.add(reason);
    }
    onChange(RETURN_REASON_OPTIONS.filter((option) => next.has(option)).join(", "));
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Accepted return reasons *</Text>
      <Text style={styles.help}>Customers can choose only the reasons selected here.</Text>
      <View style={styles.grid}>
        {RETURN_REASON_OPTIONS.map((reason) => {
          const active = selected.has(reason);
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              key={reason}
              onPress={() => toggle(reason)}
              style={[styles.option, active ? styles.optionActive : null]}
            >
              <Text style={[styles.optionText, active ? styles.optionTextActive : null]}>
                {reason}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = {
  container: {
    gap: spacing.xs,
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900" as const,
  },
  help: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  grid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: spacing.sm,
  },
  option: {
    backgroundColor: colors.softSurface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionActive: {
    backgroundColor: "#FFF0EC",
    borderColor: colors.primary,
  },
  optionText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800" as const,
  },
  optionTextActive: {
    color: colors.primary,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800" as const,
  },
};
