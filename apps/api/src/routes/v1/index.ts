import { Router } from 'express';

import { auditRouter } from './audit.js';
import { authRouter } from './auth.js';
import {
  brandsRouter,
  categoriesRouter,
  importsRouter,
  productsRouter,
  searchRouter,
} from './catalogue.js';
import { cartRouter, checkoutRouter } from './cart.js';
import { meRouter } from './me.js';
import { ordersRouter } from './orders.js';
import { pingRouter } from './ping.js';
import { permissionsRouter, rolesRouter } from './roles.js';
import { reviewsRouter, wishlistRouter } from './reviews.js';
import { socialRouter } from './social.js';
import { couponsRouter } from './coupons.js';
import { usersRouter } from './users.js';

export const v1Router: Router = Router();

// Phase 0 — smoke.
v1Router.use('/', pingRouter);

// Phase 1 — Identity & RBAC.
v1Router.use('/auth', authRouter);
v1Router.use('/me', meRouter);
v1Router.use('/users', usersRouter);
v1Router.use('/roles', rolesRouter);
v1Router.use('/permissions', permissionsRouter);
v1Router.use('/audit', auditRouter);

// Phase 2 — Social Hub.
v1Router.use('/social', socialRouter);

// Phase 3 — E-Commerce.
v1Router.use('/products', productsRouter);
v1Router.use('/categories', categoriesRouter);
v1Router.use('/brands', brandsRouter);
v1Router.use('/search', searchRouter);
v1Router.use('/imports', importsRouter);
v1Router.use('/coupons', couponsRouter);
v1Router.use('/reviews', reviewsRouter);
v1Router.use('/wishlist', wishlistRouter);
v1Router.use('/cart', cartRouter);
v1Router.use('/checkout', checkoutRouter);
v1Router.use('/orders', ordersRouter);

// Phase 4 will mount: inventoryRouter, courierRouter, crmRouter (full lifecycle).
// Phase 5 will mount: analyticsRouter, reportsRouter.
// Phase 6 will mount: accountingRouter, taxRouter, billingRouter, subscriptionRouter.
