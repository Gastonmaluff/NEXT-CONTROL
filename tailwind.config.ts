import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        next: {
          navy: "#0B3558",
          blue: "#1267C8",
          light: "#EAF4FF",
          bg: "#F5F7FA",
          text: "#0F172A",
          muted: "#64748B",
          green: "#16A34A",
          orange: "#F97316",
          red: "#DC2626"
        }
      },
      boxShadow: {
        soft: "0 14px 40px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
} satisfies Config;
