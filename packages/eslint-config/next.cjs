/** Next.js layer — pinned to App Router conventions. */
module.exports = {
  extends: ['./react.cjs', 'next/core-web-vitals'],
  rules: {
    '@next/next/no-html-link-for-pages': 'off',
  },
};
