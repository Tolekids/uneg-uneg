import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Dua halaman: feed publik (index.html) dan panel moderator (admin.html).
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
      },
    },
  },
});
