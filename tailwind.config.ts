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
        background: "var(--background)",
        foreground: "var(--foreground)",
        seneto: {
          red:            '#c9354d',
          'red-vivid':    '#e54360',
          blue:           '#1a8ab5',
          'blue-vivid':   '#4dc1ec',
          gold:           '#8a6d00',
          'gold-vivid':   '#ffd032',
          dark:           '#1a1a1a',
          bg:             '#f5f5f5',
          card:           '#f0f4f8',
          // WCAG AA-adjusted badge text (UI_KIT_FUNCTIONAL_P1 §3)
          'badge-active':  '#14732c',
          'badge-revoked': '#b02e43',
          'badge-pending': '#755c00',
          'badge-info':    '#15758f',
        },
      },
    },
  },
  plugins: [],
};
export default config;
