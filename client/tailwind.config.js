/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        fintrack: {
          DEFAULT: '#9fe870',
          active: '#cdffad',
          neutral: '#c5edab',
          pale: '#e2f6d5',
        },
        brand: {
          DEFAULT: '#9fe870',
          active: '#cdffad',
          neutral: '#c5edab',
          pale: '#e2f6d5',
        },
        ink: {
          DEFAULT: '#0e0f0c',
          deep: '#163300',
        },
        body: '#454745',
        mute: '#5f655b',
        canvas: {
          DEFAULT: '#ffffff',
          soft: '#e8ebe6',
        },
        positive: {
          DEFAULT: '#2ead4b',
          deep: '#054d28',
        },
        warning: {
          DEFAULT: '#ffd11a',
          deep: '#b86700',
          content: '#4a3b1c',
        },
        negative: {
          DEFAULT: '#d03238',
          deep: '#a72027',
          darkest: '#a7000d',
          bg: '#fce8e8',
        },
        accent: {
          orange: '#ffc091',
          cyan: '#38c8ff',
        },
      },
      borderRadius: {
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
        '2xl': '24px',
        '3xl': '24px',
        'pill': '9999px',
        'full': '9999px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 2px 8px -2px rgba(14, 15, 12, 0.05), 0 1px 4px -1px rgba(14, 15, 12, 0.03)',
        'card-hover': '0 8px 24px -4px rgba(14, 15, 12, 0.08), 0 2px 6px -1px rgba(14, 15, 12, 0.04)',
        'modal': '0 20px 48px -12px rgba(14, 15, 12, 0.18)',
      },
    },
  },
  plugins: [],
}
