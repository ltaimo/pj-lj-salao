import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1c1f24",
        graphite: "#2f343a",
        linen: "#f7f2ea",
        jade: "#177e70",
        coral: "#d95f43",
        gold: "#b88a2f"
      }
    }
  },
  plugins: []
} satisfies Config;
