import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    container: {
      center: true,
      screens: {
        sm: '672px',
        md: '832px',
        lg: '1152px',
        xl: '1440px',
        '2xl': '1728px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        'deck-row': {
          white: 'hsl(var(--deck-row-white))',
          blue: 'hsl(var(--deck-row-blue))',
          black: 'hsl(var(--deck-row-black))',
          red: 'hsl(var(--deck-row-red))',
          green: 'hsl(var(--deck-row-green))',
          gold: 'hsl(var(--deck-row-gold))',
          colorless: 'hsl(var(--deck-row-colorless))',
        },
        'deck-row-border': {
          white: 'hsl(var(--deck-row-border-white))',
          blue: 'hsl(var(--deck-row-border-blue))',
          black: 'hsl(var(--deck-row-border-black))',
          red: 'hsl(var(--deck-row-border-red))',
          green: 'hsl(var(--deck-row-border-green))',
          gold: 'hsl(var(--deck-row-border-gold))',
          colorless: 'hsl(var(--deck-row-border-colorless))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
