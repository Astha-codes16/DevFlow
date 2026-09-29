/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        devflow: {
          50: '#f0f5ff',
          100: '#e0ecff',
          200: '#b9d8ff',
          300: '#7cb7ff',
          400: '#388eff',
          500: '#0066ff',
          600: '#004ee6',
          700: '#003dbb',
          800: '#003499',
          900: '#002e7a',
          950: '#001c4f',
        },
        dark: {
          bg: '#0a0d14',
          surface: '#111726',
          card: '#161f33',
          border: '#1f2b45',
          hover: '#1b2742',
          muted: '#8b9bb4'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
