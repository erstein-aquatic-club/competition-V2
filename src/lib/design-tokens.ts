/**
 * Centralized Design Tokens
 *
 * All color, duration, spacing, and typography values should be imported from this file.
 * This ensures consistency and makes theming/rebranding easier.
 *
 * Colors use HSL CSS variables defined in src/index.css for dark mode support.
 */

// ==================== COLORS ====================

export const colors = {
  // Base colors
  background: "hsl(var(--background))",
  foreground: "hsl(var(--foreground))",

  // UI elements
  card: "hsl(var(--card))",
  cardForeground: "hsl(var(--card-foreground))",
  popover: "hsl(var(--popover))",
  popoverForeground: "hsl(var(--popover-foreground))",

  // Brand colors
  primary: "hsl(var(--primary))",
  primaryForeground: "hsl(var(--primary-foreground))",
  secondary: "hsl(var(--secondary))",
  secondaryForeground: "hsl(var(--secondary-foreground))",

  // Semantic colors
  muted: "hsl(var(--muted))",
  mutedForeground: "hsl(var(--muted-foreground))",
  accent: "hsl(var(--accent))",
  accentForeground: "hsl(var(--accent-foreground))",
  destructive: "hsl(var(--destructive))",
  destructiveForeground: "hsl(var(--destructive-foreground))",

  // Form elements
  border: "hsl(var(--border))",
  input: "hsl(var(--input))",
  ring: "hsl(var(--ring))",

  // Intensity scale (1-5, for effort/feeling ratings)
  intensity: {
    1: "hsl(var(--intensity-1))",       // Very low/best
    2: "hsl(var(--intensity-2))",       // Low
    3: "hsl(var(--intensity-3))",       // Medium
    4: "hsl(var(--intensity-4))",       // High
    5: "hsl(var(--intensity-5))",       // Very high/worst
    veryLow: "hsl(var(--intensity-1))",
    low: "hsl(var(--intensity-2))",
    medium: "hsl(var(--intensity-3))",
    high: "hsl(var(--intensity-4))",
    veryHigh: "hsl(var(--intensity-5))",
  },

  // Intensity backgrounds (lighter versions)
  intensityBg: {
    1: "hsl(var(--intensity-1-bg))",
    2: "hsl(var(--intensity-2-bg))",
    3: "hsl(var(--intensity-3-bg))",
    4: "hsl(var(--intensity-4-bg))",
    5: "hsl(var(--intensity-5-bg))",
    veryLow: "hsl(var(--intensity-1-bg))",
    low: "hsl(var(--intensity-2-bg))",
    medium: "hsl(var(--intensity-3-bg))",
    high: "hsl(var(--intensity-4-bg))",
    veryHigh: "hsl(var(--intensity-5-bg))",
  },

  // Status colors
  status: {
    success: "hsl(var(--status-success))",
    successBg: "hsl(var(--status-success-bg))",
    warning: "hsl(var(--status-warning))",
    warningBg: "hsl(var(--status-warning-bg))",
    error: "hsl(var(--status-error))",
    errorBg: "hsl(var(--status-error-bg))",
  },

  // Achievement ranks
  rank: {
    gold: "hsl(var(--rank-gold))",
    silver: "hsl(var(--rank-silver))",
    bronze: "hsl(var(--rank-bronze))",
  },

  // Category tags
  tag: {
    swimBg: "hsl(var(--tag-swim-bg))",
    swimText: "hsl(var(--tag-swim-text))",
    educBg: "hsl(var(--tag-educ-bg))",
    educText: "hsl(var(--tag-educ-text))",
  },

  // Chart colors (for data visualization)
  chart: {
    1: "hsl(var(--chart-1))",
    2: "hsl(var(--chart-2))",
    3: "hsl(var(--chart-3))",
    4: "hsl(var(--chart-4))",
    5: "hsl(var(--chart-5))",
  },

  // Common neutral colors for text contrast
  neutral: {
    black: "#000",
    white: "#fff",
  },
};

// ==================== DURATIONS ====================

/**
 * Animation durations in milliseconds
 * Use these for consistent timing across the app
 */
export const durations = {
  instant: 0,      // No animation
  fast: 150,       // Quick transitions (hover, focus)
  normal: 200,     // Default animations (most UI interactions)
  medium: 300,     // Emphasis animations (modals, drawers)
  slow: 500,       // Slow, deliberate animations (page transitions)
  slower: 800,     // Very slow (special effects)
};

/**
 * Animation durations in seconds (for Framer Motion)
 */
export const durationsSeconds = {
  instant: 0,
  fast: 0.15,
  normal: 0.2,
  medium: 0.3,
  slow: 0.5,
  slower: 0.8,
};

// ==================== SPACING ====================

/**
 * Spacing scale using Tailwind's default scale
 * Prefer using Tailwind classes (p-4, m-2, etc.) in most cases.
 * Use these constants only when dynamic spacing is needed.
 */
export const spacing = {
  0: "0",           // 0px
  px: "1px",        // 1px
  0.5: "0.125rem",  // 2px
  1: "0.25rem",     // 4px
  1.5: "0.375rem",  // 6px
  2: "0.5rem",      // 8px
  2.5: "0.625rem",  // 10px
  3: "0.75rem",     // 12px
  3.5: "0.875rem",  // 14px
  4: "1rem",        // 16px
  5: "1.25rem",     // 20px
  6: "1.5rem",      // 24px
  7: "1.75rem",     // 28px
  8: "2rem",        // 32px
  9: "2.25rem",     // 36px
  10: "2.5rem",     // 40px
  11: "2.75rem",    // 44px
  12: "3rem",       // 48px
  14: "3.5rem",     // 56px
  16: "4rem",       // 64px
  20: "5rem",       // 80px
  24: "6rem",       // 96px
  28: "7rem",       // 112px
  32: "8rem",       // 128px

  // Semantic aliases
  xs: "0.25rem",    // 4px
  sm: "0.5rem",     // 8px
  md: "1rem",       // 16px
  lg: "1.5rem",     // 24px
  xl: "2rem",       // 32px
  "2xl": "3rem",    // 48px
  "3xl": "4rem",    // 64px
  "4xl": "6rem",    // 96px
};

// ==================== TYPOGRAPHY ====================

/**
 * Font families
 * Defined in src/index.css
 */
export const typography = {
  display: "var(--font-display)", // Oswald - Headers, titles
  body: "var(--font-sans)",        // Inter - Body text
};

// ==================== Z-INDEX ====================

/**
 * Z-index scale for layering
 * Use these to maintain consistent stacking order
 */
export const zIndex = {
  overlay: 30,      // Overlays (backdrop)
  fab: 35,          // Floating action button
  mobileNav: 40,    // Mobile navigation
  bar: 45,          // Bottom/top bars
  nav: 50,          // Navigation menu
  modal: 60,        // Modal dialogs
  toast: 70,        // Toast notifications
};

// ==================== UTILITIES ====================

/**
 * Get contrast text color (black or white) based on background luminance
 * Uses HSL color format from design tokens
 */
export const getContrastTextColor = (hslColor: string): string => {
  const match = hslColor.match(/hsl\((\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\)/);
  if (!match) {
    return colors.neutral.black;
  }

  const [, hRaw, sRaw, lRaw] = match;
  const h = Number(hRaw);
  const s = Number(sRaw) / 100;
  const l = Number(lRaw) / 100;

  // Convert HSL to RGB
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;
  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else if (h >= 300 && h < 360) {
    r = c; g = 0; b = x;
  }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  // Calculate relative luminance
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

  return luminance > 155 ? colors.neutral.black : colors.neutral.white;
};
