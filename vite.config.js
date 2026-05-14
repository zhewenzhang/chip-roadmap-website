import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function copyStaticAssets() {
  return {
    name: 'copy-static-assets',
    closeBundle() {
      const root = process.cwd();
      const distDir = resolve(root, 'dist');

      // Ensure dist directory exists
      if (!existsSync(distDir)) {
        mkdirSync(distDir, { recursive: true });
      }

      // Copy optional static files (sitemap.xml, robots.txt)
      ['sitemap.xml', 'robots.txt'].forEach(file => {
        const src = resolve(root, file);
        const dest = resolve(distDir, file);

        if (!existsSync(src)) {
          console.warn(`[copy-static-assets] Optional static file missing, skipped: ${file}`);
          return;
        }

        try {
          copyFileSync(src, dest);
        } catch (err) {
          console.warn(`[copy-static-assets] Failed to copy ${file}, skipped:`, err.message);
        }
      });
    }
  };
}

export default defineConfig({
  base: '/chip-roadmap-website/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        companies: resolve(__dirname, 'companies.html'),
        roadmap: resolve(__dirname, 'roadmap.html'),
        insights: resolve(__dirname, 'insights.html'),
        signals: resolve(__dirname, 'signals.html'),
        'company-signals': resolve(__dirname, 'company-signals.html'),
        'chip-signals': resolve(__dirname, 'chip-signals.html'),
        admin: resolve(__dirname, 'admin/index.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    emptyOutDir: true
  },
  plugins: [copyStaticAssets()]
});
