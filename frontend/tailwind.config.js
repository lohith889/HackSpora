/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Settled light theme: Soft slate canvas + crisp white surface + rich charcoal ink
        // Gentle, professional contrast. No glow, no dark violet, no harsh pitch black.
        ink: {
          DEFAULT: '#0f172a', // Slate 900
          pure: '#000000',
          muted: '#475569',   // Slate 600
          faint: '#64748b',   // Slate 500
          light: '#94a3b8',   // Slate 400
          border: '#cbd5e1',  // Slate 300
        },
        paper: {
          DEFAULT: '#ffffff',
          canvas: '#f8fafc',  // Slate 50 soft background
          subtle: '#f1f5f9',  // Slate 100 table header/band
          line: '#e2e8f0',    // Slate 200 border
          strong: '#cbd5e1',  // Slate 300 border
          dark: '#0f172a',
          card: '#ffffff',
        },
        accent: {
          DEFAULT: '#b91c1c', // Deep settled red
          hover: '#991b1b',
          subtle: '#fef2f2',  // Red 50
          border: '#fca5a5',  // Red 300
          text: '#991b1b',
        },
        gov: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#072e18',
          DEFAULT: '#166534',
          hover: '#14532d',
          subtle: '#f0fdf4',
          border: '#86efac',
        },
        sage: {
          50: '#f4f7f4',
          100: '#e5ebe5',
          200: '#cbd7cc',
          700: '#405743',
          800: '#2f4232',
        },
        charcoal: {
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
          600: '#475569',
          500: '#64748b',
          400: '#94a3b8',
          100: '#f1f5f9',
          50: '#f8fafc',
        },
        saffron: {
          500: '#ea580c',
          600: '#c2410c',
        },
        warn: {
          DEFAULT: '#b45309', // Amber 700
          hover: '#92400e',
          subtle: '#fffbeb',  // Amber 50
          border: '#fcd34d',  // Amber 300
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        serif: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', 'monospace'],
      },
      boxShadow: {
        'widget': '0 20px 40px -15px rgba(15, 35, 20, 0.18), 0 0 0 1px rgba(22, 101, 52, 0.08)',
        'subtle': '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)',
        'floating': '0 10px 25px -5px rgba(20, 83, 45, 0.25), 0 8px 10px -6px rgba(20, 83, 45, 0.2)',
      },
    },
  },
  plugins: [],
}
