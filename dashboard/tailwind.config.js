/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        minecraft: {
          grass: '#5D9B47',
          dirt: '#8B5E3C',
          stone: '#7F7F7F',
          water: '#3F76E4',
          dark: '#1D1D1D',
          darker: '#141414'
        }
      }
    },
  },
  plugins: [],
}
