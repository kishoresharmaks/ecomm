import { useWindowDimensions } from "react-native";

const BASE_WIDTH = 375;

export function useResponsive() {
  const { width } = useWindowDimensions();
  const scale = width / BASE_WIDTH;
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  return {
    scale,
    pad: (base: number) => clamp(Math.round(base * scale), Math.round(base * 0.8), Math.round(base * 1.15)),
    icon: (base: number) => clamp(Math.round(base * scale), Math.round(base * 0.85), Math.round(base * 1.1)),
    gap: (base: number) => clamp(Math.round(base * scale), Math.round(base * 0.75), Math.round(base * 1.1)),
    radius: (base: number) => clamp(Math.round(base * scale), Math.round(base * 0.8), Math.round(base * 1.1)),
  };
}
