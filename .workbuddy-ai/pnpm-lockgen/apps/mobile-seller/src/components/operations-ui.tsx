import { ArrowLeft01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react-native";
import type { ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, spacing } from "../theme";

export function OperationsHeader({
  action,
  onBack,
  countLabel,
  subtitle,
  title,
}: {
  action?: {
    icon: IconSvgElement;
    label: string;
    onPress: () => void;
  } | undefined;
  onBack?: () => void;
  countLabel?: string;
  subtitle: string;
  title: string;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.eyebrowRow}>
        {onBack ? (
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} color={colors.primary} size={20} strokeWidth={2.2} />
          </Pressable>
        ) : null}
        <Text style={styles.eyebrow}>1HandIndia Seller Hub</Text>
      </View>
      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{countLabel ?? subtitle}</Text>
        </View>
        {action ? (
          <Pressable
            accessibilityLabel={action.label}
            accessibilityRole="button"
            onPress={action.onPress}
            style={({ pressed }) => [styles.headerAction, pressed ? styles.pressed : null]}
          >
            <HugeiconsIcon icon={action.icon} color={colors.surface} size={20} strokeWidth={2.2} />
            <Text style={styles.headerActionText}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      {countLabel ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function OperationsSearch({
  hint,
  onChangeText,
  placeholder,
  value,
}: {
  hint?: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.searchGroup}>
      <View style={styles.searchField}>
        <HugeiconsIcon icon={Search01Icon} color={colors.muted} size={20} strokeWidth={2} />
        <TextInput
          accessibilityLabel={placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          returnKeyType="search"
          style={styles.searchInput}
          value={value}
        />
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function OperationsFilters<Value extends string>({
  onChange,
  options,
  value,
}: {
  onChange: (value: Value) => void;
  options: ReadonlyArray<{ label: string; value: Value }>;
  value: Value;
}) {
  return (
    <ScrollView
      horizontal
      contentContainerStyle={styles.filterContent}
      showsHorizontalScrollIndicator={false}
      style={styles.filterScroll}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.filter,
              selected ? styles.filterSelected : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={[styles.filterText, selected ? styles.filterTextSelected : null]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function OperationsSection({
  action,
  children,
  subtitle,
  title,
}: {
  action?: { label: string; onPress: () => void } | undefined;
  children: ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
        </View>
        {action ? (
          <Pressable
            accessibilityRole="button"
            onPress={action.onPress}
            style={({ pressed }) => [styles.sectionAction, pressed ? styles.pressed : null]}
          >
            <Text style={styles.sectionActionText}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function OperationsInlineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.inlineError}>
      <View style={styles.inlineErrorCopy}>
        <Text style={styles.inlineErrorTitle}>Could not update this view</Text>
        <Text style={styles.inlineErrorText}>{message}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}>
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </View>
  );
}

export function OperationsEmptyState({
  action,
  icon,
  message,
  title,
}: {
  action?: { label: string; onPress: () => void } | undefined;
  icon: IconSvgElement;
  message: string;
  title: string;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <HugeiconsIcon icon={icon} color={colors.primary} size={30} strokeWidth={1.9} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{message}</Text>
      {action ? (
        <Pressable accessibilityRole="button" onPress={action.onPress} style={styles.emptyAction}>
          <Text style={styles.emptyActionText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  eyebrowRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  backButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  titleCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  title: {
    color: colors.ink,
    fontSize: 27,
    fontWeight: "900",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  headerAction: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  headerActionText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "900",
  },
  searchGroup: {
    gap: spacing.xs,
  },
  searchField: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    minHeight: 46,
    paddingVertical: 0,
  },
  hint: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: "700",
  },
  filterScroll: {
    marginHorizontal: -spacing.lg,
  },
  filterContent: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  filter: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  filterSelected: {
    backgroundColor: colors.softSurface,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  filterTextSelected: {
    color: colors.primary,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  sectionCopy: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  sectionAction: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  sectionActionText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  inlineError: {
    alignItems: "center",
    backgroundColor: "#FFF5F5",
    borderColor: "#F4C2C2",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
  },
  inlineErrorCopy: {
    flex: 1,
    gap: 2,
  },
  inlineErrorTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  inlineErrorText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
  },
  retryButton: {
    alignItems: "center",
    borderColor: colors.danger,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: spacing.sm,
  },
  retryText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "900",
  },
  empty: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    justifyContent: "center",
    maxWidth: 480,
    padding: spacing.xl,
    width: "100%",
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    borderRadius: 8,
    height: 54,
    justifyContent: "center",
    width: 54,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    textAlign: "center",
  },
  emptyAction: {
    alignItems: "center",
    borderColor: colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 140,
    paddingHorizontal: spacing.md,
  },
  emptyActionText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.72,
  },
});
