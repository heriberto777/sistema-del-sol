/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        sol: {
          50: '#fff8e6',
          100: '#ffedbf',
          200: '#ffdc85',
          300: '#ffc94a',
          400: '#ffb520',
          500: '#f59e0b',
          600: '#d17d06',
          700: '#a75f08',
          800: '#874c0e',
          900: '#713f10',
        },
      },
    },
  },
  plugins: [],
};
