import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#EEF5FF",
          100: "#D9E8FF",
          200: "#BCD7FF",
          300: "#8EBFFF",
          400: "#599BFF",
          500: "#2563EB",
          600: "#0052FF",
          700: "#003ECC",
          800: "#0031A3",
          900: "#0A1931",
        },
        surface: {
          white: "#FFFFFF",
          soft: "#F8FAFC",
          muted: "#F1F5F9",
          border: "#E2E8F0",
        },
      },
      boxShadow: {
        apple: "0 4px 24px -4px rgba(15, 23, 42, 0.06), 0 1px 4px -1px rgba(15, 23, 42, 0.04)",
        stripe: "0 12px 32px -8px rgba(0, 82, 255, 0.10), 0 2px 6px -1px rgba(15, 23, 42, 0.05)",
        glass: "0 8px 30px rgba(15, 23, 42, 0.07)",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
