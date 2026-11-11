import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        marca: {
          50: "#eef6ff",
          100: "#d9ecff",
          200: "#bcdcff",
          300: "#8ec6ff",
          400: "#59a5ff",
          500: "#3182f6",
          600: "#1f63db",
          700: "#1b4fb1",
          800: "#1c448d",
          900: "#1c3c74",
        },
      },
    },
  },
  plugins: [],
};

export default config;
