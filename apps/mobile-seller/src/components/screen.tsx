import { PropsWithChildren, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle, type ScrollViewProps } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "../theme";

export function Screen({ children, scroll = true, contentContainerStyle }: PropsWithChildren<{ scroll?: boolean; contentContainerStyle?: ScrollViewProps['contentContainerStyle'] }>) {
  const insets = useSafeAreaInsets();
  // Calculate tab bar height to prevent content from being hidden behind it
  // Tab bar base height is 74px, plus safe area bottom inset
  const tabBarHeight = 74 + Math.max(0, insets.bottom - 8);
  // Bottom spacing should account for tab bar plus additional padding
  const bottomPadding = tabBarHeight + spacing.lg;

  if (!scroll) {
    return (
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'top']}>
        <View style={[styles.nonScrollContent, { paddingBottom: bottomPadding }, contentContainerStyle as ViewStyle]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'top']}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomPadding }, contentContainerStyle]}>{children}</ScrollView>
    </SafeAreaView>
  );
}

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>1HandIndia Seller</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function ConfirmDialog({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.dialogOverlay}>
        <View style={styles.dialogCard}>
          <Text style={styles.dialogTitle}>{title}</Text>
          <Text style={styles.dialogMessage}>{message}</Text>
          <View style={styles.dialogActions}>
            <Pressable accessibilityRole="button" onPress={onCancel} style={[styles.dialogButton, styles.dialogCancel]}>
              <Text style={styles.dialogCancelText}>Cancel</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onConfirm} style={[styles.dialogButton, styles.dialogConfirm]}>
              <Text style={styles.dialogConfirmText}>Confirm</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: PropsWithChildren<{ title: string; defaultOpen?: boolean }>) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <View style={styles.collapsible}>
      <Pressable onPress={() => setIsOpen((prev) => !prev)} style={styles.collapsibleHeader}>
        <Text style={styles.collapsibleTitle}>{title}</Text>
        <Text style={styles.collapsibleIcon}>{isOpen ? "−" : "+"}</Text>
      </Pressable>
      {isOpen && <View style={styles.collapsibleContent}>{children}</View>}
    </View>
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
      style={[styles.button, tone === "secondary" ? styles.secondaryButton : null, tone === "danger" ? styles.dangerButton : null, disabled ? styles.disabled : null, style]}
    >
      {loading ? (
        <ActivityIndicator color={tone === "secondary" ? colors.ink : colors.surface} />
      ) : (
        <Text style={[styles.buttonText, tone === "secondary" ? styles.secondaryButtonText : null]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label?: string | undefined; error?: string | undefined }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor="#9CA3AF" style={[styles.input, error ? styles.inputError : null]} {...props} />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function SelectField({ label, options, selectedValue, onSelect, error, placeholder = "Select..." }: {
  label?: string | undefined;
  options: Array<{ label: string; value: string }>;
  selectedValue: string;
  onSelect: (value: string) => void;
  error?: string | undefined;
  placeholder?: string | undefined;
}) {
  const [visible, setVisible] = useState(false);
  const selectedOption = options.find((opt) => opt.value === selectedValue);
  const displayValue = selectedOption?.label || placeholder;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={() => setVisible(true)} style={[styles.input, error ? styles.inputError : null]}>
        <Text style={[styles.selectText, !selectedValue && styles.placeholderText]}>{displayValue}</Text>
      </Pressable>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{label}</Text>
            <ScrollView style={styles.optionList}>
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  style={[styles.optionItem, option.value === selectedValue && styles.optionItemSelected]}
                  onPress={() => {
                    onSelect(option.value);
                    setVisible(false);
                  }}
                >
                  <Text style={[styles.optionText, option.value === selectedValue && styles.optionTextSelected]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.modalClose} onPress={() => setVisible(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export function StatusChip({ label, tone = "info" }: { label: string; tone?: "info" | "success" | "warning" | "danger" }) {
  return (
    <View style={[styles.chip, tone === "success" ? styles.chipSuccess : tone === "warning" ? styles.chipWarning : tone === "danger" ? styles.chipDanger : null]}>
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

export function QueryErrorState({
  title = "Could not load data",
  message,
  onRetry,
  retrying = false,
}: {
  title?: string;
  message?: string | undefined;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <Card style={styles.errorCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{message ?? "Please check your connection and try again."}</Text>
      <Button title="Retry" tone="secondary" onPress={onRetry} loading={retrying} />
    </Card>
  );
}

export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

export function Toast({ visible, message, type = "info", onDismiss }: { visible: boolean; message: string; type?: "success" | "error" | "info"; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(onDismiss, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <View style={[styles.toast, { bottom: Math.max(spacing.xl, insets.bottom + spacing.lg) }, type === "success" ? styles.toastSuccess : type === "error" ? styles.toastError : null]}>
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
}

export function Skeleton({ height = 40 }: { height?: number }) {
  return <View style={[styles.skeleton, { height }]} />;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.secondary,
  },
  nonScrollContent: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  scroll: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  errorCard: {
    borderColor: colors.danger,
  },
  collapsible: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  collapsibleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.softSurface,
  },
  collapsibleTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  collapsibleIcon: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "900",
  },
  collapsibleContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 46,
    justifyContent: "center",
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  dangerButton: {
    backgroundColor: colors.danger,
  },
  disabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "900",
  },
  secondaryButtonText: {
    color: colors.ink,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  inputError: {
    borderColor: colors.danger,
  },
  fieldError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700",
  },
  selectText: {
    color: colors.ink,
    fontSize: 15,
  },
  placeholderText: {
    color: "#9CA3AF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionList: {
    maxHeight: 400,
  },
  optionItem: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionItemSelected: {
    backgroundColor: colors.softSurface,
  },
  optionText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  optionTextSelected: {
    color: colors.primary,
  },
  modalClose: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "center",
  },
  modalCloseText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800",
  },
  chip: {
    alignSelf: "flex-start",
    backgroundColor: colors.softSurface,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipSuccess: {
    backgroundColor: "#DCFCE7",
  },
  chipWarning: {
    backgroundColor: "#FEF3C7",
  },
  chipDanger: {
    backgroundColor: "#FEE2E2",
  },
  chipText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900",
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  loading: {
    alignItems: "center",
    flex: 1,
    gap: spacing.md,
    justifyContent: "center",
    padding: spacing.xl,
  },
  toast: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.ink,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: "center",
    zIndex: 1000,
  },
  toastSuccess: {
    backgroundColor: "#22C55E",
  },
  toastError: {
    backgroundColor: colors.danger,
  },
  toastText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "700",
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.52)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  dialogCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  dialogTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  dialogMessage: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  dialogActions: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  dialogButton: {
    borderRadius: 8,
    minHeight: 44,
    minWidth: 104,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  dialogCancel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  dialogConfirm: {
    backgroundColor: colors.danger,
  },
  dialogCancelText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  dialogConfirmText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "900",
  },
  skeleton: {
    backgroundColor: colors.softSurface,
    borderRadius: 8,
  },
});

export const commonStyles = styles;
