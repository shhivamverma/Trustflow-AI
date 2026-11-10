import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        midnight: {
          950: "#040711",
          900: "#070c18",
          850: "#0a1224",
          800: "#0f172a",
          700: "#1e293b",
          600: "#334155",
        },
        electric: {
          cyan: "#00E5FF",
          blue: "#0066FF",
          sky: "#38BDF8",
          indigo: "#6366F1",
        },
        paypal: {
          blue: "#003087",
          light: "#0079C1",
          gold: "#FFC439",
        },
        status: {
          draft: { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1" },
          sent: { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
          paid: { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0" },
          partial: { bg: "#FEF3C7", text: "#B45309", border: "#FDE68A" },
          overdue: { bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA" },
          canceled: { bg: "#F3F4F6", text: "#374151", border: "#E5E7EB" },
          needssync: { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A" },
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float-slow": "float 6s ease-in-out infinite",
        "shimmer": "shimmer 2.5s linear infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
export default config;

