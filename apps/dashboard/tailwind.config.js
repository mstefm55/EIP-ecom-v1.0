export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Montserrat", "sans-serif"],
        display: ["Comfortaa", "sans-serif"],
      },
      colors: {
        ink: {
          50: "#f4f7fb",
          100: "#e4eaf3",
          200: "#c6d1e2",
          300: "#a3b0c7",
          400: "#6c7c97",
          500: "#4c5b75",
          600: "#3a465c",
          700: "#2b3345",
          800: "#1e2434",
          900: "#121826",
        },
        mist: {
          50: "#f7f6f4",
          100: "#efebe6",
          200: "#e4ddd6",
          300: "#d4cbbf",
          400: "#bfae9b",
        },
        brand: {
          100: "#e2f2f3",
          200: "#c6e4e6",
          300: "#8fc8cf",
          400: "#5caab6",
          500: "#2f8fa0",
          600: "#1f6f84",
          700: "#185969",
        },
      },
      borderRadius: {
        "3xl": "1.75rem",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        float: "float 8s ease-in-out infinite",
        "fade-up": "fadeUp 500ms ease both",
      },
    },
  },
  plugins: [],
};
