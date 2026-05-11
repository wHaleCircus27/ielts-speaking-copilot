import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#172033',
        muted: '#5d6678',
        line: '#d8dee8',
        panel: '#f7f8fb',
        accent: '#1c7c74',
        warn: '#a15c10'
      }
    }
  },
  plugins: []
};

export default config;