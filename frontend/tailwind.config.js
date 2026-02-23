/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'rgb(var(--c-primary) / <alpha-value>)',
          dark: 'rgb(var(--c-primary-dark) / <alpha-value>)',
          light: 'rgb(var(--c-primary-light) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--c-secondary) / <alpha-value>)',
          dark: 'rgb(var(--c-secondary-dark) / <alpha-value>)',
          light: 'rgb(var(--c-secondary-light) / <alpha-value>)',
        },
        accent: {
          DEFAULT: '#ffd43b',
          dark: '#fab005',
        },
        success: {
          DEFAULT: '#51cf66',
          dark: '#40c057',
        },
        danger: {
          DEFAULT: '#ff6b6b',
          dark: '#fa5252',
        },
        warning: {
          DEFAULT: '#fcc419',
          dark: '#fab005',
        },
        info: {
          DEFAULT: '#748ffc',
          dark: '#5c7cfa',
        },
        dark: {
          950: 'rgb(var(--c-dark-950) / <alpha-value>)',
          900: 'rgb(var(--c-dark-900) / <alpha-value>)',
          800: 'rgb(var(--c-dark-800) / <alpha-value>)',
          700: 'rgb(var(--c-dark-700) / <alpha-value>)',
          600: 'rgb(var(--c-dark-600) / <alpha-value>)',
          500: 'rgb(var(--c-dark-500) / <alpha-value>)',
          400: 'rgb(var(--c-dark-400) / <alpha-value>)',
          300: 'rgb(var(--c-dark-300) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--c-text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--c-text-secondary) / <alpha-value>)',
          muted: 'rgb(var(--c-text-muted) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        heading: ['Space Grotesk', 'Plus Jakarta Sans', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, rgb(var(--c-primary)) 0%, rgb(var(--c-secondary)) 100%)',
        'gradient-secondary': 'linear-gradient(135deg, rgb(var(--c-secondary)) 0%, rgb(var(--c-secondary-dark)) 100%)',
        'gradient-accent': 'linear-gradient(135deg, #ffd43b 0%, #ff922b 100%)',
        'gradient-success': 'linear-gradient(135deg, #51cf66 0%, #20c997 100%)',
        'gradient-info': 'linear-gradient(135deg, #748ffc 0%, #5c7cfa 100%)',
        'gradient-dark': 'linear-gradient(180deg, rgb(var(--c-dark-800)) 0%, rgb(var(--c-dark-700)) 100%)',
      },
      boxShadow: {
        'glow-primary': '0 0 20px rgb(var(--c-primary) / 0.3)',
        'glow-secondary': '0 0 20px rgb(var(--c-secondary) / 0.3)',
        'glow-success': '0 0 20px rgba(81, 207, 102, 0.3)',
        'card': 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '20px',
        '4xl': '24px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgb(var(--c-primary) / 0.2)' },
          '100%': { boxShadow: '0 0 20px rgb(var(--c-primary) / 0.4)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
