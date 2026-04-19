import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#FFB800',
          light: '#FFF4CC',
          dark: '#7A5000',
        },
        warn: {
          DEFAULT: '#FFB800',
          light: '#FFF4CC',
        },
        danger: {
          DEFAULT: '#A32D2D',
          light: '#FCEBEB',
        },
        info: {
          DEFAULT: '#185FA5',
          light: '#E6F1FB',
        },
        pm: {
          bg: '#f5f5f0',
          card: '#ffffff',
          muted: '#eeede8',
          border: 'rgba(0,0,0,0.12)',
          'border-strong': 'rgba(0,0,0,0.22)',
          text: '#1a1a18',
          'text-2': '#5f5e5a',
          'text-3': '#888780',
          ee: '#378ADD',
          me: '#7F77DD',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        md: '8px',
        lg: '12px',
      },
    },
  },
  plugins: [],
}

export default config
