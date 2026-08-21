/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F5F4F0",
        surface: "#FFFFFF",
        primary: {
          DEFAULT: "#173A5E",
          dark: "#0E2942",
          light: "#315D85",
          soft: "#EAF0F5",
        },
        secondary: {
          DEFAULT: "#2F6F6D",
        },
        accent: {
          DEFAULT: "#B8893A",
          dark: "#8C6727",
          soft: "#F6EEDC",
        },
        badge: {
          orange: "#A65F2B",
          indigo: "#4B5E88",
          teal: "#2F6F6D",
          pink: "#8D5572",
        },
        success: "#36785E",
        danger: "#B64B45",
        warning: "#AA7422",
        ink: {
          900: "#182533",
          800: "#243543",
          700: "#344554",
          600: "#53636F",
          500: "#6A7782",
          400: "#828D96",
          300: "#9AA4AC",
          100: "#E1E3E2",
          50: "#F2F2EF",
        },
      },
      fontFamily: {
        serif: ["Source Serif 4", "Georgia", "serif"],
        display: ["DM Sans", "Inter", "system-ui", "sans-serif"],
        heritage: ["Source Serif 4", "Georgia", "serif"],
        sans: ["DM Sans", "Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #173A5E 0%, #0E2942 100%)",
      },
      borderRadius: {
        card: "10px",
        pill: "999px",
      },
      boxShadow: {
        // Paired with a hairline border — depth comes from the border,
        // not from a large diffuse drop shadow.
        card: "0 1px 2px rgba(24,37,51,0.04), 0 10px 28px -24px rgba(24,37,51,0.28)",
        "card-hover": "0 14px 34px -22px rgba(24,37,51,0.32)",
        btn: "0 1px 2px rgba(24,37,51,0.10)",
        popover: "0 18px 48px -18px rgba(14,41,66,0.32)",
        glow: "0 0 0 3px rgba(23,58,94,0.12)",
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
          "0%": { boxShadow: "0 0 0 0 rgba(23,58,94,0.28)" },
          "70%": { boxShadow: "0 0 0 8px rgba(23,58,94,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(23,58,94,0)" },
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
