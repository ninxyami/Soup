import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0e0e0e",
        surface: "#0f1318",
        "s-border": "#1e2530",
        accent: "#c8a84b",
        "accent-green": "#4a7c59",
        danger: "#e05555",
        success: "#4caf7d",
        info: "#4a8fc4",
        dim: "#6b7280",
        "text-main": "#c8cdd6",
      },
      fontFamily: {
        mono: ["'Share Tech Mono'", "monospace"],
        display: ["'Bebas Neue'", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
