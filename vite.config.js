import { resolve } from 'path';
import { defineConfig } from 'vite';
import eslint from 'vite-plugin-eslint';
import fsp from 'fs/promises';

// Match .html files
const htmlFileRegex = /\.html$/;

// Correct lowercase postfix (fixed)
const postfix = '?.html-import';
const postfixRe = /[?#].*$/s;

// Cleans up postfix from file path
function cleanUrl(url) {
  return url.replace(postfixRe, '');
}

// Plugin to handle HTML imports during build
const htmlImportBuild = () => ({
  name: 'html-import:build',
  enforce: 'pre',
  apply: 'build',

  async resolve(id, importer, options) {
    if (htmlFileRegex.test(id) && !options) {
      let res = await this.resolve(id, importer, {
        skipSelf: true,
        ...options
      });

      if (!res || res.external) return res;
      return res.id + postfix; // ✅ now using defined lowercase variable
    }
  },

  async load(id) {
    if (!id.endsWith(postfix)) return;

    let htmlContent = await fsp.readFile(cleanUrl(id));

    // Return HTML as JS module string
    return `export default ${JSON.stringify(htmlContent.toString('utf-8'))}`;
  }
});

// Plugin for HTML imports during dev server
function htmlImportServe() {
  return {
    name: 'html-import:serve',
    apply: 'serve',

    transform(src, id) {
      if (htmlFileRegex.test(id)) {
        return {
          code: `export default ${JSON.stringify(src)}`
        };
      }
    }
  };
}

export default defineConfig({
  publicDir: 'public',
  root: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            const modulePath = id.split('node_modules/')[1];
            const topLevelFolder = modulePath?.split('/')[0];

            if (!topLevelFolder) {
              const scopedPackageName = modulePath?.split('/')[1];
              return scopedPackageName?.split('@')[
                scopedPackageName.startsWith('@') ? 1 : 0
              ];
            }

            return topLevelFolder;
          }

          return null;
        },
      },
    },
    minify: 'esbuild',
  },
  plugins: [
    eslint({
      cache: false,
      fix: true,
    }),
    htmlImportBuild(),  // fixed plugin
    htmlImportServe(),  // dev-time plugin
  ],
});
