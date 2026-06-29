import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        studio: {
          bg: "#080A12",
          panel: "#101320",
          panel2: "#151A2D",
          line: "rgba(255,255,255,0.10)",
          text: "#F7F7FF",
          muted: "#A7ADC4",
          purple: "#8B5CF6",
          pink: "#EC4899",
          cyan: "#22D3EE"
        }
      },
      boxShadow: {
        glow: "0 0 60px rgba(139,92,246,.25)",
        cyanGlow: "0 0 48px rgba(34,211,238,.18)"
      }
    }
  },
  plugins: []
};

export default config;
