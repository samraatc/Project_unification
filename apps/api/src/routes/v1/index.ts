import { Router } from 'express';

import { accountingRouter } from './accounting.js';
import { analyticsRouter } from './analytics.js';
import { auditRouter } from './audit.js';
import { authRouter } from './auth.js';
import { billingRouter } from './billing.js';
import {
  brandsRouter,
  categoriesRouter,
  importsRouter,
  productsRouter,
  searchRouter,
} from './catalogue.js';
import { cartRouter, checkoutRouter } from './cart.js';
import { couponsRouter } from './coupons.js';
import { couriersRouter } from './couriers.js';
import { customersRouter } from './customers.js';
import {
  inventoryRouter,
  purchaseOrdersRouter,
  stockMovementsRouter,
} from './inventory.js';
import { meRouter } from './me.js';
import { ordersRouter } from './orders.js';
import { pingRouter } from './ping.js';
import { permissionsRouter, rolesRouter } from './roles.js';
import { reportsRouter } from './reports.js';
import { reviewsRouter, wishlistRouter } from './reviews.js';
import { socialRouter } from './social.js';
import { usersRouter } from './users.js';

export const v1Router: Router = Router();

v1Router.use('/', pingRouter);

// Phase 1
v1Router.use('/auth', authRouter);
v1Router.use('/me', meRouter);
v1Router.use('/users', usersRouter);
v1Router.use('/roles', rolesRouter);
v1Router.use('/permissions', permissionsRouter);
v1Router.use('/audit', auditRouter);

// Phase 2
v1Router.use('/social', socialRouter);

// Phase 3
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

// Phase 4
v1Router.use('/inventory', inventoryRouter);
v1Router.use('/purchase-orders', purchaseOrdersRouter);
v1Router.use('/stock-movements', stockMovementsRouter);
v1Router.use('/couriers', couriersRouter);
v1Router.use('/customers', customersRouter);

// Phase 5 — Analytics + reports
v1Router.use('/analytics', analyticsRouter);
v1Router.use('/reports', reportsRouter);

// Phase 6 — Premium Accounting + Subscription
v1Router.use('/accounting', accountingRouter);
v1Router.use('/billing', billingRouter);
