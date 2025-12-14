import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      keyframes: {
        // Existing Animations
        typing: {
          '0%': { width: '0ch' },
          '100%': { width: '12ch' }  // "F9" = 12 characters
        },
        blink: {
          '0%, 50%': { borderColor: 'transparent' },
          '51%, 100%' : { borderColor: 'currentColor' },
        },
        pulse: { // Moved 'pulse' here
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        fadeIn: { // Renamed from 'animate-in' to standard 'fadeIn' keyframe
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        
        // Suggested New Animations
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-in': { // Using 'fade-in' as keyframe name to match utility class
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        }
      },
      animation: {
        // Existing Animations
        typing: 'typing 2.5s steps(12) infinite alternate',
        blink: 'blink .7s infinite',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite', // Updated 'pulse'
        'animate-in': 'fadeIn 0.3s ease-out', // Kept for compatibility with old class name but using 'fadeIn' keyframe
        
        // Suggested New Animations
        shimmer: 'shimmer 2s infinite',
        'fade-in': 'fade-in 0.3s ease-out',
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
      },
    },
  },
  plugins: [],
};

export default config;