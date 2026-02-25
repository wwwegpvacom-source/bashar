/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./**/*.{html,js}",
    "!./node_modules/**"
  ],
  safelist: [
    'bg-gradient-to-br',
    'from-blue-500', 'to-blue-600',
    'from-red-500', 'to-red-600',
    'from-pink-500', 'to-pink-600',
    'from-green-500', 'to-green-600',
    'from-purple-500', 'to-purple-600',
    'from-orange-500', 'to-orange-600',
    'from-cyan-500', 'to-cyan-600',
    'from-indigo-500', 'to-indigo-600',
    'from-gray-600', 'to-gray-700',
    'text-transparent', 'bg-clip-text', 'bg-gradient-to-r',
    'from-cyan-400', 'via-blue-500', 'to-purple-600', 'text-glow'
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
