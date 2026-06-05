import { defineConfig } from 'vite';

export default defineConfig({
  // Serve the public/ folder at root
  publicDir: 'public',

  server: {
    port: 5174,
    proxy: {
      // Forward /api and /audio to the Express speech server
      '/api':   'http://localhost:3001',
      '/audio': 'http://localhost:3001',
    },
    headers: {
      // Cache GLB for 1 year (UUID-named audio files bypass this via proxy)
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  },

  build: {
    // Raise chunk size warning threshold — the Three.js bundle is ~600 KB
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Split Three.js into its own cached chunk
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
});
