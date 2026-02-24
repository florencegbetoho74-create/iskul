export const COLOR = {
  bg: "#F4F7FC",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  text: "#0B1220",
  sub: "#5A6780",
  primary: "#2F5BFF",
  accent: "#F59E0B",
  success: "#16A34A",
  warn: "#F59E0B",
  danger: "#DC2626",
  border: "#DCE4F1",
  muted: "#EEF3FA",
  tint: "#EAF0FF",
  overlay: "rgba(11, 18, 32, 0.08)",
  ring: "#C7D6FF",
} as const;

export const FONT = {
  heading: "Sora_700Bold",
  headingAlt: "Sora_600SemiBold",
  body: "Manrope_500Medium",
  bodyBold: "Manrope_700Bold",
  mono: "Menlo"
} as const;

export const RADIUS = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
} as const;

export const SPACE = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
} as const;

export const ELEVATION = {
  card: {
    shadowColor: "#0B1D39",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  floating: {
    shadowColor: "#0B1D39",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
} as const;
