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
          'primary-strong': 'var(--facturom-primary-strong)',
          'primary-dark': 'var(--facturom-primary-dark)',
          'primary-soft': 'var(--facturom-primary-soft)',
          'primary-soft-2': 'var(--facturom-primary-soft-2)',
          accent: 'var(--facturom-accent)',
          yellow: 'var(--facturom-yellow)',
          bg: 'var(--facturom-bg)',
          surface: 'var(--facturom-surface)',
          border: 'var(--facturom-border)',
          text: 'var(--facturom-text)',
          'text-muted': 'var(--facturom-text-muted)',
          sidebar: 'var(--facturom-sidebar)'
        },
      },
    },
  },
  plugins: [],
}

export default config
