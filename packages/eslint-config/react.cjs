/** React + jsx-a11y layer. Accessibility rules enforce WCAG 2.1 AA (TRD §5). */
module.exports = {
  extends: [
    './index.cjs',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
  ],
  plugins: ['react', 'react-hooks', 'jsx-a11y'],
  settings: { react: { version: 'detect' } },
  rules: {
    'react/prop-types': 'off',
    'react-hooks/exhaustive-deps': 'warn',
  },
};
