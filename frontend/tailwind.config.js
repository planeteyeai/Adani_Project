/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#060b18",
          900: "#0a1120",
          800: "#111a2e",
          700: "#1a2540",
        },
        brand: {
          400: "#38e1c6",
          500: "#12c9b0",
          600: "#0ea394",
        },
        accent: {
          400: "#6aa8ff",
          500: "#3b82f6",
        },
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(56, 225, 198, 0.5)",
      },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "spin-slow": "spin-slow 60s linear infinite",
      },
    },
  },
  plugins: [],
};
