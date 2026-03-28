/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // New design system
        coral: {
          DEFAULT: 'rgb(var(--c-coral) / <alpha-value>)',
          hover: 'rgb(var(--c-coral-hover) / <alpha-value>)',
        },
        // Accent colors
        blue: {
          DEFAULT: 'rgb(var(--c-blue) / <alpha-value>)',
        },
        green: {
          DEFAULT: 'rgb(var(--c-green) / <alpha-value>)',
        },
        amber: {
          DEFAULT: 'rgb(var(--c-amber) / <alpha-value>)',
        },
        purple: {
          DEFAULT: 'rgb(var(--c-purple) / <alpha-value>)',
        },
        // Background scale
        'bg-primary': 'rgb(var(--c-bg-primary) / <alpha-value>)',
        'bg-secondary': 'rgb(var(--c-bg-secondary) / <alpha-value>)',
        'bg-card': 'rgb(var(--c-bg-card) / <alpha-value>)',
        'bg-elevated': 'rgb(var(--c-bg-elevated) / <alpha-value>)',
        // Text
        text: {
          primary: 'rgb(var(--c-text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--c-text-secondary) / <alpha-value>)',
          muted: 'rgb(var(--c-text-muted) / <alpha-value>)',
        },
        // Backward compat aliases for existing pages
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
          DEFAULT: 'rgb(var(--c-green) / <alpha-value>)',
          dark: '#059669',
        },
        danger: {
          DEFAULT: 'rgb(var(--c-coral) / <alpha-value>)',
          dark: '#dc2626',
        },
        warning: {
          DEFAULT: 'rgb(var(--c-amber) / <alpha-value>)',
          dark: '#d97706',
        },
        info: {
          DEFAULT: 'rgb(var(--c-blue) / <alpha-value>)',
          dark: '#2563eb',
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
      },
      fontFamily: {
        sans: ['DM Sans', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        heading: ['DM Sans', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, rgb(var(--c-coral)) 0%, rgb(var(--c-coral-hover)) 100%)',
        'gradient-secondary': 'linear-gradient(135deg, rgb(var(--c-purple)) 0%, rgb(var(--c-secondary-dark)) 100%)',
        'gradient-accent': 'linear-gradient(135deg, #ffd43b 0%, #ff922b 100%)',
        'gradient-success': 'linear-gradient(135deg, rgb(var(--c-green)) 0%, #34d399 100%)',
        'gradient-info': 'linear-gradient(135deg, rgb(var(--c-blue)) 0%, #60a5fa 100%)',
      },
      boxShadow: {
        'glow-primary': 'var(--shadow-glow-coral)',
        'glow-coral': 'var(--shadow-glow-coral)',
        'glow-secondary': '0 0 20px rgba(139, 92, 246, 0.3)',
        'glow-success': '0 0 20px rgba(16, 185, 129, 0.3)',
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
        'spin-slow': 'spin 1.2s linear infinite',
        'fade-in': 'fadeIn 0.4s ease-out',
        'fade-up': 'fadeUp 0.5s ease-out',
        'slide-in-right': 'slideInRight 0.35s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'pop-in': 'popIn 0.4s ease-out',
        'bounce-in': 'bounceIn 0.4s ease-out',
        'gentle-glow': 'gentleGlow 2.5s ease-in-out infinite',
        'orb-float-1': 'orbFloat1 12s ease-in-out infinite',
        'orb-float-2': 'orbFloat2 15s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(232, 54, 79, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(232, 54, 79, 0.4)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
