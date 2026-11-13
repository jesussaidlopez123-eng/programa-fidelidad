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
          DEFAULT: "#0045A5",
          deep: "#003785",
        },
        page: "#F8FAFD",
        surface: "#FFFFFF",
        ink: "#212529",
        muted: "#8A92A6",
        midnight: {
          DEFAULT: "#0B1120",
          soft: "#1A2344",
        },
        success: {
          DEFAULT: "#1B7A4E",
          soft: "#E8F5EE",
        },
        danger: {
          DEFAULT: "#C0392B",
          soft: "#FDECEC",
        },
        line: "#E2E8F0",
        /* Legacy aliases mapped to CREDICEL */
        cream: "#F8FAFD",
        forest: {
          DEFAULT: "#0045A5",
          deep: "#003785",
        },
        teal: {
          DEFAULT: "#0045A5",
          deep: "#003785",
        },
        gold: {
          DEFAULT: "#0045A5",
          deep: "#003785",
        },
      },
      borderRadius: {
        lg: "0.625rem",
        xl: "0.75rem",
        "2xl": "0.75rem",
        "3xl": "0.875rem",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "sans-serif"],
        display: ["var(--font-sans)", "ui-sans-serif", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
