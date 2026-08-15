/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F7F8FA",
        surface: "#FFFFFF",
        primary: {
          DEFAULT: "#2563EB",
          dark: "#1D4ED8",
          light: "#3B82F6",
          soft: "#EFF6FF",
        },
        secondary: {
          DEFAULT: "#0D9488",
        },
        badge: {
          orange: "#C2410C",
          indigo: "#4338CA",
          teal: "#0F766E",
          pink: "#BE185D",
        },
        success: "#059669",
        danger: "#DC2626",
        warning: "#D97706",
        ink: {
          900: "#0F172A",
          700: "#334155",
          500: "#64748B",
          300: "#94A3B8",
          100: "#E2E8F0",
          50: "#F1F5F9",
        },
      },
      fontFamily: {
        // Single typeface across the product — serif display type reads as
        // marketing-site, not operational software.
        serif: ["Manrope", "Inter", "system-ui", "sans-serif"],
        sans: ["Manrope", "Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
      },
      borderRadius: {
        card: "10px",
        pill: "999px",
      },
      boxShadow: {
        // Paired with a hairline border — depth comes from the border,
        // not from a large diffuse drop shadow.
        card: "0 1px 2px rgba(15,23,42,0.04)",
        "card-hover": "0 4px 12px -2px rgba(15,23,42,0.08)",
        btn: "0 1px 2px rgba(15,23,42,0.05)",
        popover: "0 10px 30px -5px rgba(15,23,42,0.15)",
        glow: "0 0 0 3px rgba(37,99,235,0.12)",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        fadeInUp: {
          from: { opacity: 0, transform: "translateY(10px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        fadeInDown: {
          from: { opacity: 0, transform: "translateY(-6px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        scaleIn: {
          from: { opacity: 0, transform: "scale(0.96)" },
          to: { opacity: 1, transform: "scale(1)" },
        },
        slideInRight: {
          from: { opacity: 0, transform: "translateX(16px)" },
          to: { opacity: 1, transform: "translateX(0)" },
        },
        slideInLeft: {
          from: { opacity: 0, transform: "translateX(-16px)" },
          to: { opacity: 1, transform: "translateX(0)" },
        },
        slideInBottom: {
          from: { opacity: 0, transform: "translateY(12px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
        countUp: {
          from: { opacity: 0, transform: "translateY(4px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        pulseRing: {
          "0%": { boxShadow: "0 0 0 0 rgba(37,99,235,0.30)" },
          "70%": { boxShadow: "0 0 0 8px rgba(37,99,235,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(37,99,235,0)" },
        },
        float: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(0, -18px)" },
        },
        floatSlow: {
          "0%, 100%": { transform: "translate(0, 0) rotate(0deg)" },
          "50%": { transform: "translate(10px, -12px) rotate(4deg)" },
        },
        shake: {
          "10%, 90%": { transform: "translateX(-1px)" },
          "20%, 80%": { transform: "translateX(2px)" },
          "30%, 50%, 70%": { transform: "translateX(-4px)" },
          "40%, 60%": { transform: "translateX(4px)" },
        },
      },
      animation: {
        "fade-in": "fadeIn 0.35s ease-out both",
        "fade-in-up": "fadeInUp 0.45s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in-down": "fadeInDown 0.35s ease-out both",
        "scale-in": "scaleIn 0.22s cubic-bezier(0.16,1,0.3,1) both",
        "slide-in-right": "slideInRight 0.3s cubic-bezier(0.16,1,0.3,1) both",
        "slide-in-left": "slideInLeft 0.3s cubic-bezier(0.16,1,0.3,1) both",
        "slide-in-bottom": "slideInBottom 0.3s cubic-bezier(0.16,1,0.3,1) both",
        shimmer: "shimmer 1.8s linear infinite",
        "count-up": "countUp 0.4s ease-out both",
        "pulse-ring": "pulseRing 2s cubic-bezier(0.4,0,0.6,1) infinite",
        float: "float 6s ease-in-out infinite",
        "float-slow": "floatSlow 9s ease-in-out infinite",
        shake: "shake 0.4s cubic-bezier(0.36,0.07,0.19,0.97) both",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.16,1,0.3,1)",
      },
    },
  },
  plugins: [],
};
