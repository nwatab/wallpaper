import path from 'path';
import fs from 'fs/promises';

import typescript from '@rollup/plugin-typescript';
import postcss from 'rollup-plugin-postcss';
import autoprefixer from 'autoprefixer';

const DIST_DIR = 'dist';

const isProduction = process.env.NODE_ENV === 'production';

export default {
  input: 'src/index.ts',
  output: {
    dir: DIST_DIR,
    format: 'iife',
    name: 'WallpaperApp',
  },
  plugins: [
    typescript({ sourceMap: true }),
    postcss({
      plugins: [autoprefixer()],
      extract: true, // CSS を別ファイルに出力
    }),
    isProduction &&
    (await import('@rollup/plugin-terser')).default({
      compress: {
        drop_console: true,
      },
    }),
    copyHtmlPlugin(),
    copyDirectoryPlugin('public', DIST_DIR),
  ],
};

function copyHtmlPlugin() {
  return {
    name: 'copy-html',

    writeBundle: async () => {
      try {
        const srcPath = path.resolve('src', 'index.html');
        const destPath = path.resolve(DIST_DIR, 'index.html');
        await fs.copyFile(srcPath, destPath);
      } catch (error) {
        console.error('index.html のコピー中にエラーが発生しました:', error);
        throw error;
      }
    },
  };
}

async function copyDirectoryPlugin(src, dest) {
  return {
    name: `copy-${src}`,
    writeBundle: async () => {
      try {
        await fs.mkdir(dest, { recursive: true });

        // コピー元ディレクトリの内容を取得
        const entries = await fs.readdir(src, { withFileTypes: true });

        // 各エントリをコピー
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);

          if (entry.isDirectory()) {
            await copyDirectoryContents(srcPath, destPath);
          } else {
            await fs.copyFile(srcPath, destPath);
          }
        }
      } catch (err) {
        console.error('ディレクトリのコピー中にエラーが発生しました:', err);
      }
    }
  }
}
