/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'var(--color-border-primary)',
        input: 'var(--color-border-primary)',
        ring: 'var(--color-focus)',
        background: 'var(--color-background-primary)',
        foreground: 'var(--color-text-primary)',
        surface: {
          DEFAULT: 'var(--color-background-secondary)',
          raised: 'var(--color-surface-raised)',
          sunken: 'var(--color-background-tertiary)',
        },
        primary: { DEFAULT: 'var(--color-action)', foreground: 'var(--color-action-text)' },
        muted: { DEFAULT: 'var(--color-background-tertiary)', foreground: 'var(--color-text-secondary)' },
        accent: { DEFAULT: 'var(--color-background-tertiary)', foreground: 'var(--color-text-primary)' },
        destructive: { DEFAULT: 'var(--color-critical)', foreground: '#FFFFFF' },
        popover: { DEFAULT: 'var(--color-surface-raised)', foreground: 'var(--color-text-primary)' },
        card: { DEFAULT: 'var(--color-surface-raised)', foreground: 'var(--color-text-primary)' },
      },
      fontFamily: {
        display: ['SvD Ester Blenda', 'Georgia', 'serif'],
        head: ['Sueca Hd', 'Georgia', 'serif'],
        body: ['Sueca Tx', 'Georgia', 'serif'],
        ui: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: { lg: '10px', md: '8px', sm: '6px' },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'fade-in': { from: { opacity: '0', transform: 'translateY(2px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.18s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
