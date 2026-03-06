/** @type {import('next').NextConfig} */
const nextConfig = {
  // Genera un servidor Node.js standalone — necesario para Docker
  output: 'standalone',

  // Exponer variables de entorno al cliente
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },

  // Optimizaciones de imagen (dominios externos si se agregan avatares, etc.)
  images: {
    remotePatterns: [],
  },
}

module.exports = nextConfig
