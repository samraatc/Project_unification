const designSystemPreset = require('@unified/design-system/tailwind-preset');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [designSystemPreset],
  content: [
    './src/**/*.{ts,tsx,mdx}',
    '../../packages/design-system/src/**/*.{ts,tsx}',
  ],
};
