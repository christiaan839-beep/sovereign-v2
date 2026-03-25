/**
 * SOVEREIGN MATRIX — Design Tokens
 *
 * Single source of truth for all colors, spacing, and component styles.
 * Import from here instead of hardcoding hex values in pages.
 */

export const colors = {
  // Surfaces
  surface: "#050505",
  surfaceCard: "#0A0A0A",
  surfaceElevated: "#111111",

  // Accent (primary brand color)
  accent: "#00B7FF",
  accentHover: "#33C5FF",
  accentMuted: "rgba(0, 183, 255, 0.10)",
  accentBorder: "rgba(0, 183, 255, 0.20)",

  // Semantic
  success: "#10B981",
  successMuted: "rgba(16, 185, 129, 0.10)",
  warning: "#F59E0B",
  warningMuted: "rgba(245, 158, 11, 0.10)",
  error: "#EF4444",
  errorMuted: "rgba(239, 68, 68, 0.10)",

  // Text
  textPrimary: "#F5F5F5",
  textSecondary: "#A3A3A3",
  textTertiary: "#737373",
  textMuted: "#525252",

  // Borders
  border: "rgba(255, 255, 255, 0.06)",
  borderHover: "rgba(255, 255, 255, 0.12)",
  borderActive: "rgba(255, 255, 255, 0.20)",
} as const;

export const glassmorphism = {
  card: "bg-white/[0.03] backdrop-blur-xl border border-white/[0.06]",
  cardHover: "hover:bg-white/[0.05] hover:border-white/[0.12]",
  elevated: "bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08]",
  input: "bg-white/[0.04] border border-white/[0.08] focus:border-[#00B7FF]/30",
} as const;

export const spacing = {
  page: "p-6 lg:p-8",
  pageX: "px-6 lg:px-8",
  pageY: "py-6 lg:py-8",
  section: "mb-8",
  cardPadding: "p-5",
  gap: "gap-4",
  gapLg: "gap-6",
} as const;

export const typography = {
  pageTitle: "text-2xl font-bold text-white tracking-tight",
  pageDescription: "text-sm text-neutral-400 mt-1",
  sectionTitle: "text-lg font-semibold text-white",
  cardTitle: "text-sm font-semibold text-white",
  label: "text-[10px] font-bold uppercase tracking-widest text-neutral-500",
  body: "text-sm text-neutral-300",
  mono: "font-mono text-xs text-neutral-400",
} as const;

export const animation = {
  cardStagger: {
    container: { transition: { staggerChildren: 0.05 } },
    item: {
      initial: { opacity: 0, y: 12 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.3 },
    },
  },
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.2 },
  },
} as const;
