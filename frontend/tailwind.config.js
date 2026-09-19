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
          DEFAULT: '#166534', // Forest green
          hover: '#14532d',
          subtle: '#f0fdf4',  // Green 50
          border: '#86efac',  // Green 300
        },
        warn: {
          DEFAULT: '#b45309', // Amber 700
          hover: '#92400e',
          subtle: '#fffbeb',  // Amber 50
          border: '#fcd34d',  // Amber 300
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', 'monospace'],
      },
      borderRadius: {
        none: '0px',
        DEFAULT: '0px',
        sm: '2px',
        md: '4px',
        lg: '4px',
        xl: '4px',
        '2xl': '4px',
        full: '4px', // Hard limit: max border-radius is 4px
      },
      boxShadow: {
        none: 'none',
        sm: 'none',
        md: 'none',
        lg: 'none',
        xl: 'none',
        '2xl': 'none',
      },
    },
  },
  plugins: [],
}
