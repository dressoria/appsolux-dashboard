import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx,js,jsx,mdx}',
    './components/**/*.{ts,tsx,js,jsx,mdx}',
    './lib/**/*.{ts,tsx,js,jsx}',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        facturom: {
          primary: 'var(--facturom-primary)',
          'primary-dark': 'var(--facturom-primary-dark)',
          'primary-soft': 'var(--facturom-primary-soft)',
          accent: 'var(--facturom-accent)',
          yellow: 'var(--facturom-yellow)',
          bg: 'var(--facturom-bg)',
          surface: 'var(--facturom-surface)',
          text: 'var(--facturom-text)',
          sidebar: 'var(--facturom-primary-dark)'
        },
      },
    },
  },
  plugins: [],
}

export default config
