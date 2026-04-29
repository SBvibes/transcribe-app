import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0d1117",
        panel: "#111821",
        line: "#27313c",
        muted: "#8c929d",
        teal: "#58e6d2",
        gold: "#ffd166",
        redsoft: "#ff5d66",
        lime: "#a6e22e"
      },
      fontFamily: {
        mono: [
          "Space Mono",
          "Fira Code",
          "IBM Plex Mono",
          "Consolas",
          "ui-monospace",
          "SFMono-Regular",
          "monospace"
        ]
      },
      boxShadow: {
        glow: "0 0 80px rgba(88, 230, 210, 0.08)",
        insetSoft: "inset 0 1px 0 rgba(255,255,255,0.04)"
      }
    }
  },
  plugins: []
};

export default config;
