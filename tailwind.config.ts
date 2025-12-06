extend: {
  keyframes: {
    typing: {
      '0%': { width: '0ch' },
      '100%': { width: '12ch' }   // "freelance9ja" = 12 characters
    },
    blink: {
      '0%, 50%': { borderColor: 'transparent' },
      '51%, 100%' : { borderColor: 'currentColor' },
    }
  },
  animation: {
    typing: 'typing 2.5s steps(12) infinite alternate',
    blink: 'blink .7s infinite'
  }
}
