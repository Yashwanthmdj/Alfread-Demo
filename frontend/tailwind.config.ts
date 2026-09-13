import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia"],
      },
      colors: {
        ink: "#1c1915",
        paper: "#f4f1ea",
        pine: "#1f4d3a",
      },
      boxShadow: {
        panel: "0 24px 80px -24px rgba(28, 25, 21, 0.28)",
      },
    },
  },
  plugins: [],
};

export default config;
