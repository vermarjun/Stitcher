import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Force a SINGLE copy of React/React-DOM across the app and all deps. Without
    // this, Vite's dep pre-bundling could hand a library (e.g. motion/react's
    // AnimatePresence) a second React whose dispatcher is null → runtime crash
    // "Cannot read properties of null (reading 'useContext')". Dedupe makes every
    // motion/react component robust against that class of error.
    dedupe: ["react", "react-dom"],
  },
})
