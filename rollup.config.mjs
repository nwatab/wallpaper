import path from 'path';
import { promises as fs } from 'fs';

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
