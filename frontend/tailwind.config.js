/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Indian Government Portal palette (NIC/Digital India)
        gov: {
          blue:    '#003366',
          navy:    '#00234B',
          saffron: '#FF6600',
          green:   '#138808',
          'light-blue': '#0056A2',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
