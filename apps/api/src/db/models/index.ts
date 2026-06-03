export { User, type UserDoc } from './user.model.js';
export { Role, type RoleDoc } from './role.model.js';
export { UserRole, type UserRoleDoc } from './userRole.model.js';
export { Permission, type PermissionDoc } from './permission.model.js';
export { RefreshToken, type RefreshTokenDoc } from './refreshToken.model.js';
export { Otp, type OtpDoc } from './otp.model.js';
export { AuditLog, type AuditLogDoc } from './auditLog.model.js';

// Phase 2 — Social
export { SocialAccount, type SocialAccountDoc } from './socialAccount.model.js';
export { Post, type PostDoc } from './post.model.js';
export { InboxMessage, type InboxMessageDoc } from './inboxMessage.model.js';
export { MediaAsset, type MediaAssetDoc } from './mediaAsset.model.js';
export { PaymentEvent, type PaymentEventDoc } from './paymentEvent.model.js';

// Phase 3 — Catalogue + Cart + Checkout + Orders
export { Brand, type BrandDoc } from './brand.model.js';
export { Category, type CategoryDoc } from './category.model.js';
export { Product, type ProductDoc } from './product.model.js';
export { Inventory, type InventoryDoc } from './inventory.model.js';
export { StockMovement, type StockMovementDoc } from './stockMovement.model.js';
export { Coupon, type CouponDoc } from './coupon.model.js';
export { Review, type ReviewDoc } from './review.model.js';
export { Cart, type CartDoc } from './cart.model.js';
export { CheckoutSession, type CheckoutSessionDoc } from './checkoutSession.model.js';
export { Order, type OrderDoc } from './order.model.js';
