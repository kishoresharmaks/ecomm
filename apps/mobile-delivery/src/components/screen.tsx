import { PropsWithChildren, ReactNode, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "../theme";

export function Screen({
  children,
  onRefresh,
  refreshing = false,
  scroll = true,
}: PropsWithChildren<{ onRefresh?: () => unknown; refreshing?: boolean; scroll?: boolean }>) {
  const insets = useSafeAreaInsets();
  const bottomPadding = 88 + Math.max(0, insets.bottom);
  if (!scroll) {
    return (
      <SafeAreaView style={styles.safe} edges={["left", "right", "top"]}>
        <View style={[styles.nonScrollContent, { paddingBottom: bottomPadding }]}>{children}</View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "top"]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPadding }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} tintColor={colors.primary} onRefresh={() => void onRefresh()} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Header({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>1HandIndia Delivery</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Metric({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <Card style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {note ? <Text style={styles.metricNote}>{note}</Text> : null}
    </Card>
  );
}

export function Button({
  title,
  onPress,
  disabled,
  tone = "primary",
  loading = false,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "primary" | "secondary" | "danger";
  loading?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.button,
        tone === "secondary" ? styles.secondaryButton : null,
        tone === "danger" ? styles.dangerButton : null,
        disabled || loading ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone === "secondary" ? colors.ink : colors.surface} />
      ) : (
        <Text style={[styles.buttonText, tone === "secondary" ? styles.secondaryButtonText : null]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label?: string; error?: string }) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput placeholderTextColor="#9CA3AF" style={[styles.input, error ? styles.inputError : null]} {...props} />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function SelectField({
  label,
  options,
  selectedValue,
  onSelect,
}: {
  label: string;
  options: Array<{ label: string; value: string }>;
  selectedValue: string;
  onSelect: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const selected = options.find((option) => option.value === selectedValue);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable accessibilityRole="button" onPress={() => setVisible(true)} style={styles.input}>
        <Text style={styles.selectText}>{selected?.label ?? "Select"}</Text>
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{label}</Text>
            {options.map((option) => (
              <Pressable
                accessibilityRole="button"
                key={option.value}
                onPress={() => {
                  onSelect(option.value);
                  setVisible(false);
                }}
                style={[styles.optionItem, option.value === selectedValue ? styles.optionItemSelected : null]}
              >
                <Text style={styles.optionText}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export function StatusChip({ label, tone = "info" }: { label: string; tone?: "info" | "success" | "warning" | "danger" | "neutral" }) {
  return (
    <View
      style={[
        styles.chip,
        tone === "success" ? styles.chipSuccess : null,
        tone === "warning" ? styles.chipWarning : null,
        tone === "danger" ? styles.chipDanger : null,
        tone === "neutral" ? styles.chipNeutral : null,
      ]}
    >
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <Card>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </Card>
  );
}

export function QueryState({
  loading,
  error,
  onRetry,
}: {
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
}) {
  if (loading) {
    return (
      <Card>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.emptyText}>Loading delivery data...</Text>
      </Card>
    );
  }
  if (error) {
    return (
      <Card style={styles.errorCard}>
        <Text style={styles.emptyTitle}>Could not load data</Text>
        <Text style={styles.emptyText}>{error instanceof Error ? error.message : "Please check your connection and try again."}</Text>
        {onRetry ? <Button title="Retry" tone="secondary" onPress={onRetry} /> : null}
      </Card>
    );
  }
  return null;
}

export function formatPaise(value?: number | null, currency = "INR") {
  const amount = (value ?? 0) / 100;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

export function humanize(value?: string | null) {
  return (value ?? "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatDateTime(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.secondary, flex: 1 },
  scroll: { gap: spacing.lg, padding: spacing.lg },
  nonScrollContent: { flex: 1, gap: spacing.lg, padding: spacing.lg },
  header: { alignItems: "flex-start", flexDirection: "row", gap: spacing.md },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  title: { color: colors.navy, fontSize: 28, fontWeight: "900", lineHeight: 34 },
  subtitle: { color: colors.muted, fontSize: 14, fontWeight: "600", lineHeight: 20, marginTop: 4 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
  metric: { flex: 1, minWidth: 150 },
  metricLabel: { color: colors.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  metricValue: { color: colors.navy, fontSize: 22, fontWeight: "900" },
  metricNote: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  button: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 14, justifyContent: "center", minHeight: 48, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  secondaryButton: { backgroundColor: colors.softSurface, borderColor: colors.border, borderWidth: 1 },
  dangerButton: { backgroundColor: colors.danger },
  disabled: { opacity: 0.55 },
  buttonText: { color: colors.surface, fontSize: 14, fontWeight: "900" },
  secondaryButtonText: { color: colors.ink },
  field: { gap: spacing.xs },
  label: { color: colors.ink, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  input: { backgroundColor: "#F8FAFC", borderColor: "#D8E2EA", borderRadius: 12, borderWidth: 1, color: colors.ink, minHeight: 48, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  inputError: { borderColor: colors.danger },
  fieldError: { color: colors.danger, fontSize: 12, fontWeight: "700" },
  selectText: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  modalOverlay: { alignItems: "center", backgroundColor: "rgba(17,24,39,0.42)", flex: 1, justifyContent: "center", padding: spacing.lg },
  modalContent: { backgroundColor: colors.surface, borderRadius: 18, gap: spacing.sm, padding: spacing.lg, width: "100%" },
  modalTitle: { color: colors.navy, fontSize: 18, fontWeight: "900" },
  optionItem: { borderRadius: 12, padding: spacing.md },
  optionItemSelected: { backgroundColor: colors.softSurface },
  optionText: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  chip: { alignSelf: "flex-start", backgroundColor: "#EEF6FF", borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipSuccess: { backgroundColor: "#E9F7F1" },
  chipWarning: { backgroundColor: "#FFF7E6" },
  chipDanger: { backgroundColor: "#FDECEC" },
  chipNeutral: { backgroundColor: "#F3F4F6" },
  chipText: { color: colors.ink, fontSize: 11, fontWeight: "900" },
  emptyTitle: { color: colors.navy, fontSize: 18, fontWeight: "900" },
  emptyText: { color: colors.muted, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  errorCard: { borderColor: "#F5B7B7" },
});
