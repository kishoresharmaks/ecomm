import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { StarIcon } from "@hugeicons/core-free-icons";
import type { SubmitProductReviewPayload } from "../features/storefront/storefront-api";

const MAX_TITLE = 120;
const MAX_COMMENT = 2000;
const STAR_COUNT = 5;

interface ReviewFormProps {
  orderItemId: string;
  onSubmit: (payload: SubmitProductReviewPayload) => Promise<void>;
  isSubmitting: boolean;
  error: string;
  onCancel?: () => void;
}

export function ReviewForm({ orderItemId, onSubmit, isSubmitting, error, onCancel }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");

  const canSubmit = rating > 0 && !isSubmitting;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({
      orderItemId,
      rating,
      title: title.trim() ? title.trim() : null,
      comment: comment.trim() ? comment.trim() : null,
    });
  }

  const handlePressIn = useCallback((starIndex: number) => setHoveredStar(starIndex), []);
  const handlePressOut = useCallback(() => setHoveredStar(0), []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Write a review</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Your rating</Text>
        <View style={styles.starRow}>
          {Array.from({ length: STAR_COUNT }).map((_, index) => {
            const filled = index < (hoveredStar || rating);
            return (
              <Pressable
                key={index}
                accessibilityLabel={`${index + 1} star${index > 0 ? "s" : ""}`}
                accessibilityRole="button"
                onPress={() => setRating(index + 1)}
                onPressIn={() => handlePressIn(index + 1)}
                onPressOut={handlePressOut}
                style={({ pressed }) => [
                  styles.starButton,
                  pressed && styles.starButtonPressed,
                ]}
              >
                <HugeiconsIcon
                  icon={StarIcon}
                  size={40}
                  color={filled ? "#F59E0B" : "#D1D5DB"}
                  strokeWidth={filled ? 1.8 : 1.3}
                />
              </Pressable>
            );
          })}
          {rating > 0 && (
            <Text style={styles.ratingText}>{rating} / 5</Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Title (optional)</Text>
        <TextInput
          accessibilityLabel="Review title"
          maxLength={MAX_TITLE}
          onChangeText={setTitle}
          placeholder="Summarize your experience"
          placeholderTextColor="#9AA4B2"
          style={styles.input}
          value={title}
        />
        <Text style={styles.hint}>{title.length}/{MAX_TITLE}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Your review (optional)</Text>
        <TextInput
          accessibilityLabel="Review comment"
          maxLength={MAX_COMMENT}
          multiline
          numberOfLines={5}
          onChangeText={setComment}
          placeholder="What did you like or dislike?"
          placeholderTextColor="#9AA4B2"
          style={[styles.input, styles.textarea]}
          textAlignVertical="top"
          value={comment}
        />
        <Text style={styles.hint}>{comment.length}/{MAX_COMMENT}</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        {onCancel ? (
          <Pressable onPress={onCancel} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        ) : null}
        <Pressable
          disabled={!canSubmit}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.submitButton,
            !canSubmit && styles.submitButtonDisabled,
            pressed && canSubmit && styles.submitButtonPressed,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Submit review</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  heading: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 10,
  },
  starRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  starButton: {
    alignItems: "center",
    borderRadius: 12,
    justifyContent: "center",
    padding: 4,
  },
  starButtonPressed: {
    transform: [{ scale: 1.15 }],
  },
  ratingText: {
    color: "#6B7280",
    fontSize: 15,
    fontWeight: "800",
    marginLeft: 12,
  },
  input: {
    backgroundColor: "#FFFBFA",
    borderColor: "#F3E7E2",
    borderRadius: 16,
    borderWidth: 1,
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
    padding: 14,
  },
  textarea: {
    minHeight: 120,
  },
  hint: {
    color: "#9AA4B2",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 6,
    textAlign: "right",
  },
  error: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    marginBottom: 16,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    alignItems: "center",
    borderColor: "#F3E7E2",
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    paddingVertical: 16,
  },
  cancelButtonText: {
    color: "#6B7280",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  submitButton: {
    alignItems: "center",
    backgroundColor: "#ED3500",
    borderRadius: 22,
    flex: 2,
    justifyContent: "center",
    paddingVertical: 16,
  },
  submitButtonDisabled: {
    backgroundColor: "#9AA4B2",
  },
  submitButtonPressed: {
    opacity: 0.88,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },
});
