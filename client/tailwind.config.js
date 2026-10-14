/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          50: '#fbf8eb',
          100: '#f5eecc',
          200: '#ebdc99',
          300: '#dec460',
          400: '#d4ad33',
          500: '#b8921a',
          600: '#967113',
          700: '#755212',
          800: '#624316',
          900: '#543818',
        }
      }
    },
  },
  plugins: [],
}
