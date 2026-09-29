/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef4ff',
          100: '#dbe6fe',
          200: '#bfd3fe',
          300: '#93b4fd',
          400: '#6090fa',
          500: '#3b6bf6',
          600: '#254ceb',
          700: '#1d39d8',
          800: '#1e30af',
          900: '#1e2d8a',
          950: '#171e54',
        },
        accent: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
