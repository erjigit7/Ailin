/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        seat: {
          free: '#d32f2f',
          sold: '#616161',
          booked: '#f9a825',
          selected: '#2e9e5b',
        },
      },
    },
  },
  plugins: [],
};
