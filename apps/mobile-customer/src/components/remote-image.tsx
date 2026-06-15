import { SvgUri } from "react-native-svg";
import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "../theme";

type RemoteImageProps = {
  fallbackLabel?: string;
  resizeMode?: "cover" | "contain";
  style: StyleProp<ImageStyle>;
  uri?: string | null;
};

export function RemoteImage({ fallbackLabel = "1HI", resizeMode = "cover", style, uri }: RemoteImageProps) {
  if (!uri) {
    return (
      <View style={[styles.fallback, style as StyleProp<ViewStyle>]}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.fallbackText}>
          {fallbackText(fallbackLabel)}
        </Text>
      </View>
    );
  }

  if (isSvgImageUrl(uri)) {
    return (
      <View style={[styles.svgSurface, style as StyleProp<ViewStyle>]}>
        <SvgUri height="100%" uri={uri} width="100%" />
      </View>
    );
  }

  return <Image resizeMode={resizeMode} source={{ uri }} style={style} />;
}

function isSvgImageUrl(uri: string) {
  const normalized = decodeURIComponent(uri).toLowerCase();
  return normalized.includes(".svg") || normalized.includes("image/svg+xml");
}

function fallbackText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "1HI";
  }

  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    backgroundColor: colors.softSurface,
    justifyContent: "center",
  },
  fallbackText: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: "900",
    maxWidth: "80%",
  },
  svgSurface: {
    backgroundColor: "#F8FAFC",
    overflow: "hidden",
  },
});
