import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        /* Harbor of Care — Deep Blue primary, Warm Orange secondary */
        primary: {
          DEFAULT: '#242B61',
          50: '#EEEEF8',
          100: '#DCDDF1',
          200: '#B9BAE3',
          300: '#9698D5',
          400: '#7375C7',
          500: '#535A93',
          600: '#3B4279',
          700: '#242B61',
          800: '#0D144B',
          900: '#0A1038',
          950: '#070B26',
          container: '#E0E3FF',
        },
        secondary: {
          DEFAULT: '#E86A24',
          50: '#FFF4ED',
          100: '#FFE6D5',
          200: '#FFCBA6',
          300: '#FFB871',
          400: '#FF9A47',
          500: '#E86A24',
          600: '#C2510C',
          700: '#9A3D0C',
          800: '#7C3012',
          900: '#5E2500',
          950: '#3B1500',
          container: '#FFEDE2',
        },
        surface: {
          DEFAULT: '#F8F9FF',
          dim: '#D5DAE6',
          bright: '#F8F9FF',
          container: {
            DEFAULT: '#E9EEFA',
            low: '#EFF4FF',
            lowest: '#FFFFFF',
            high: '#E3E8F4',
            highest: '#DDE3EE',
          },
        },
        'on-surface': {
          DEFAULT: '#161C24',
          variant: '#46464F',
        },
        outline: {
          DEFAULT: '#767680',
          variant: '#C7C5D1',
        },
        error: {
          DEFAULT: '#BA1A1A',
          container: '#FFDAD6',
        },
        /* Legacy compatibility aliases */
        navy: {
          50: '#F0F4F8',
          100: '#D9E2EC',
          200: '#BCCCDC',
          300: '#9FB3C8',
          400: '#829AB1',
          500: '#627D98',
          600: '#486581',
          700: '#334E68',
          800: '#243B53',
          900: '#1E3A5F',
          950: '#102A43',
        },
      },
      fontFamily: {
        sans: ['Lexend', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Lexend', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        headline: ['Lexend', 'sans-serif'],
        body: ['Lexend', 'sans-serif'],
        label: ['Lexend', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        'atmospheric': '0 12px 40px 0 rgba(22, 28, 36, 0.05)',
        'atmospheric-lg': '0 20px 60px 0 rgba(22, 28, 36, 0.08)',
        'glow-primary': '0 0 20px rgba(36, 43, 97, 0.15)',
        'glow-secondary': '0 0 20px rgba(232, 106, 36, 0.3)',
      },
    },
  },
  plugins: [],
};

export default config;
