import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync, copyFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function copyStaticAssets() {
  return {
    name: 'copy-static-assets',
    closeBundle() {
      const root = process.cwd();
      const distDir = resolve(root, 'dist');

      // Copy data/ directory
      const srcData = resolve(root, 'data');
      const destData = resolve(distDir, 'data');
      if (!existsSync(destData)) mkdirSync(destData, { recursive: true });
      readdirSync(srcData).forEach(file => {
        copyFileSync(resolve(srcData, file), resolve(destData, file));
      });

      // Copy sitemap.xml and robots.txt
      ['sitemap.xml', 'robots.txt'].forEach(file => {
        const src = resolve(root, file);
        if (existsSync(src)) copyFileSync(src, resolve(distDir, file));
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
