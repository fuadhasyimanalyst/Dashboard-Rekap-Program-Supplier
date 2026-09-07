/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0E1B22',
          900: '#12232C',
          800: '#1A323D',
          700: '#234351',
        },
        sand: {
          50: '#F7F5F0',
          100: '#F1EDE4',
          200: '#E7E0D2',
        },
        brass: {
          400: '#D9A441',
          500: '#C4922F',
          600: '#A87824',
        },
        pine: {
          500: '#2F8F6B',
          600: '#257356',
        },
        clay: {
          500: '#C1543C',
          600: '#A6432E',
        },
      },
      fontFamily: {
        sans: ['"Public Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
