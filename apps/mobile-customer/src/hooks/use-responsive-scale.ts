import { useWindowDimensions } from "react-native";

const BASE_WIDTH = 375;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function useResponsiveScale() {
  const { width } = useWindowDimensions();

  const s = clamp(width / BASE_WIDTH, 0.82, 1.12);

  return {
    /** Full scale ratio for reference */
    scale: s,

    /** Horizontal padding — e.g. pad(14) → 14 * scale */
    pad: (base: number) => Math.round(base * s),

    /** Icon square size — slightly more restrained */
    icon: (base: number) => clamp(Math.round(base * s), Math.round(base * 0.88), Math.round(base * 1.08)),

    /** Gap between elements */
    gap: (base: number) => clamp(Math.round(base * s), Math.round(base * 0.78), Math.round(base * 1.08)),

    /** Border radius */
    radius: (base: number) => Math.round(base * s),

    /** Font size — very restrained to preserve readability */
    text: (base: number) => clamp(Math.round(base * s), Math.round(base * 0.9), Math.round(base * 1.04)),
  };
}
