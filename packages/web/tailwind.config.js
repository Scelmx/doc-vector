/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        background: '#f0f4f8',
        surface: '#ffffff',
        'surface-light': '#f8fafc',
        border: '#e2e8f0',
        'text-primary': '#0f172a',
        'text-secondary': '#64748b',
        accent: '#06b6d4',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.06)',
        'card-hover': '0 10px 25px -5px rgb(59 130 246 / 0.12), 0 4px 6px -4px rgb(15 23 42 / 0.05)',
      },
      backgroundImage: {
        'tech-gradient': 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 50%, #f0f4f8 100%)',
        'hero-glow': 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59, 130, 246, 0.15), transparent)',
      },
    },
  },
  plugins: [],
}
