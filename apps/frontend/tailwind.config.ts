import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paleta principal — oscura y profesional
        surface: {
          DEFAULT: '#0F1117',
          raised: '#161B27',
          2: '#161B27',
          overlay: '#1E2536',
          border: '#2A3347',
        },
        brand: {
          DEFAULT: '#3B82F6',
          hover: '#2563EB',
          muted: '#1E3A5F',
        },
        // Canales
        channel: {
          whatsapp: '#25D366',
          instagram: '#E1306C',
          facebook: '#1877F2',
          email: '#6366F1',
          form: '#F59E0B',
          api: '#64748B',
        },
        // Score labels
        score: {
          cold: '#64748B',
          warm: '#F59E0B',
          hot: '#EF4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
      },
    },
  },
  plugins: [],
}

export default config
