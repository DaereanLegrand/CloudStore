/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        'deep-forest': 'linear-gradient(145deg, #0a1a14 0%, #0d211a 35%, #0f2a1f 65%, #143028 100%)',
        'specular': 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.01) 100%)',
        'emerald-glow': 'radial-gradient(ellipse at 50% 0%, rgba(21,150,106,0.08) 0%, transparent 70%)',
      },
      boxShadow: {
        'subtle': '0 1px 2px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.15)',
        'glass': '0 2px 8px rgba(0,0,0,0.25), 0 1px 2px rgba(0,0,0,0.2)',
        'glass-lg': '0 4px 24px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.2)',
        'inner-edge': 'inset 0 0 0 1px rgba(255,255,255,0.06)',
        'emerald': '0 0 20px rgba(21,150,106,0.15)',
      },
      colors: {
        emerald: {
          DEFAULT: '#15966a',
          dark: '#0f7a57',
          deeper: '#0b5e43',
          light: '#d1fae5',
          subtle: 'rgba(21,150,106,0.08)',
        },
      },
      borderRadius: {
        '2lg': '0.625rem',
      },
    },
  },
  plugins: [],
}
