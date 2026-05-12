import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync, copyFileSync, mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs';

// Vite 默认只处理 JS/TS 入口，我们需要复制 HTML 和其他静态文件
function copyStaticFiles() {
  return {
    name: 'copy-static',
    buildStart() {
      // 这个插件在构建时不做事，我们用 transformIndexHtml 或直接复制
    },
    closeBundle() {
      // 构建完成后复制 HTML 和数据文件
      const root = process.cwd();
      const distDir = resolve(root, 'dist');
      
      if (!existsSync(distDir)) {
        mkdirSync(distDir, { recursive: true });
      }

      // 复制 HTML 文件
      const htmlFiles = ['index.html', 'companies.html', 'roadmap.html', 'insights.html'];
      htmlFiles.forEach(file => {
        const src = resolve(root, file);
        const dest = resolve(distDir, file);
        if (existsSync(src)) {
          copyFileSync(src, dest);
          // 修改 script src 为构建后的路径
          let content = readFileSync(dest, 'utf-8');
          // Vite 会将 module script 转换为 /assets/app-<hash>.js
          // 但由于我们没有入口在 HTML 中引用，需要手动处理
          content = content.replace(
            /<script type="module" src="js\/app\.js"><\/script>/,
            '<script type="module" crossorigin src="/assets/app.js"><\/script>'
          );
          writeFileSync(dest, content, 'utf-8');
        }
      });

      // 复制 css, js, data 目录
      ['css', 'data'].forEach(dir => {
        const srcDir = resolve(root, dir);
        const destDir = resolve(distDir, dir);
        if (existsSync(srcDir)) {
          if (!existsSync(destDir)) {
            mkdirSync(destDir, { recursive: true });
          }
          readdirSync(srcDir).forEach(file => {
            const srcFile = resolve(srcDir, file);
            const destFile = resolve(destDir, file);
            copyFileSync(srcFile, destFile);
          });
        }
      });

      // 复制 sitemap.xml 和 robots.txt
      ['sitemap.xml', 'robots.txt'].forEach(file => {
        const src = resolve(root, file);
        const dest = resolve(distDir, file);
        if (existsSync(src)) {
          copyFileSync(src, dest);
        }
      });
    }
  };
}

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: resolve(__dirname, 'js/app.js'),
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    },
    emptyOutDir: true
  },
  root: '.',
  plugins: [copyStaticFiles()]
});
