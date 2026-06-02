/** Node service layer — for apps/api, apps/worker, apps/webhook. */
module.exports = {
  extends: ['./index.cjs'],
  env: { node: true, es2022: true },
  rules: {
    'no-process-exit': 'error',
  },
};
