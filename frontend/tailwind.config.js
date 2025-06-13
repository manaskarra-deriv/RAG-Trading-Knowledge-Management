/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        'deriv-primary': '#00A19C',
        'deriv-secondary': '#14C8B0',
        'deriv-dark': '#0E0E0E',
        'deriv-gray': '#242424',
        'deriv-light-gray': '#3B3B3B',
        'deriv-text': '#C2C2C2',
        'deriv-white': '#FFFFFF',
        'deriv-success': '#4BB543',
        'deriv-warning': '#FFB020',
        'deriv-error': '#EC3F3F'
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif']
      }
    },
  },
  plugins: [],
} 