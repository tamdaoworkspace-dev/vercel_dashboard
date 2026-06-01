/** @type {import('tailwindcss').Config} */
module.exports = {
  // Auto light/dark theo cài đặt hệ thống (prefers-color-scheme)
  darkMode: "media",
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        tdg: {
          // Các token nền/chữ lấy từ CSS variables -> tự đổi theo light/dark
          bg: "var(--tdg-bg)",
          card: "var(--tdg-card)",
          elev: "var(--tdg-elev)",
          text: "var(--tdg-text)",
          secondary: "var(--tdg-secondary)",
          tertiary: "var(--tdg-tertiary)",
          border: "var(--tdg-border)",
          accent: "var(--tdg-accent)",
          "accent-light": "#E8C76A",
          "accent-dark": "#A07D2E",
          positive: "var(--tdg-positive)",
          negative: "var(--tdg-negative)",
          warm: "#D4825A",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Inter",
          "Helvetica Neue",
          "sans-serif",
        ],
      },
      borderRadius: {
        ios: "16px",
        "ios-lg": "20px",
        pill: "9999px",
      },
      boxShadow: {
        ios: "0 1px 3px rgba(0,0,0,0.08)",
        glow: "0 3px 16px rgba(200,162,77,0.35)",
      },
    },
  },
  plugins: [],
};
