/**
 * Style Dictionary build — emits CSS variables (light + dark) plus a Tailwind theme JSON.
 * Run: `pnpm --filter @unified/design-system tokens:build`
 */
const StyleDictionary = require('style-dictionary');
const path = require('path');

const sd = StyleDictionary.extend({
  source: [path.join(__dirname, 'tokens.json')],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: path.join(__dirname, '../src/generated/'),
      files: [{ destination: 'tokens.css', format: 'css/variables' }],
    },
    js: {
      transformGroup: 'js',
      buildPath: path.join(__dirname, '../src/generated/'),
      files: [{ destination: 'tokens.js', format: 'javascript/es6' }],
    },
  },
});

sd.buildAllPlatforms();
console.log('Tokens built → packages/design-system/src/generated/');
