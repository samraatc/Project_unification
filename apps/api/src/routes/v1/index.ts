import { Router } from 'express';

import { pingRouter } from './ping.js';

export const v1Router: Router = Router();

v1Router.use('/', pingRouter);
// Phase 1 will mount: authRouter, rbacRouter, userRouter, auditRouter.
