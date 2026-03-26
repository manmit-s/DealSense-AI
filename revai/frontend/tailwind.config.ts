import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        base: 'var(--bg-base)',
        surface: 'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        cyan: 'var(--accent-cyan)',
        purple: 'var(--accent-purple)',
        green: 'var(--accent-green)',
        amber: 'var(--accent-amber)',
        red: 'var(--accent-red)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        border: 'var(--border-color)',
      },
      fontFamily: {
        sans: ['var(--font-dm-sans)'],
        mono: ['var(--font-space-mono)'],
      },
    },
  },
  plugins: [],
};
export default config;