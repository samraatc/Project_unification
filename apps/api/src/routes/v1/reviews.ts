import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';

import { Order, Product, Review, User } from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { audit } from '../../services/audit.service.js';

export const reviewsRouter: Router = Router();
export const wishlistRouter: Router = Router();

/* -------------------------------------------------------------------------- */
/* Reviews                                                                    */
/* -------------------------------------------------------------------------- */

const PostReviewBody = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  body: z.string().max(4000).optional(),
  media: z.array(z.object({ url: z.string().url(), mime: z.string() })).max(8).optional(),
});

reviewsRouter.post('/', requireAuth, validate(PostReviewBody), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof PostReviewBody>;
    // PRD §3.3: verified buyers only — caller must have a delivered/returned order
    // containing this product.
    const eligible = await Order.exists({
      tenantId: req.user!.tenantId,
      userId: req.user!.sub,
      status: { $in: ['delivered', 'returned', 'refunded'] },
      'items.productId': body.productId,
    });
    if (!eligible) {
      throw new HttpError(403, 'NOT_VERIFIED_BUYER', 'Only verified buyers can review this product.');
    }

    const doc = await Review.create({
      tenantId: req.user!.tenantId,
      productId: body.productId,
      userId: req.user!.sub,
      rating: body.rating,
      title: body.title,
      body: body.body,
      media: body.media ?? [],
      status: 'published',
    });

    // Recompute the product's running rating average.
    const stats = await Review.aggregate([
      { $match: { productId: new Types.ObjectId(body.productId), status: 'published' } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    if (stats[0]) {
      await Product.updateOne(
        { _id: body.productId },
        { $set: { 'rating.avg': stats[0].avg, 'rating.count': stats[0].count } },
      );
    }

    await audit({
      tenantId: req.user!.tenantId,
      actorId: req.user!.sub,
      action: 'review.created',
      entity: 'Review',
      entityId: doc._id,
      afterJson: { productId: body.productId, rating: body.rating },
      ip: req.ip,
      ua: req.headers['user-agent'],
    });
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

reviewsRouter.get('/product/:productId', async (req, res, next) => {
  try {
    const docs = await Review.find({ productId: req.params.productId, status: 'published' })
      .sort({ helpfulVotes: -1, createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ data: docs });
  } catch (err) {
    next(err);
  }
});

reviewsRouter.post('/:id/helpful', requireAuth, async (req, res, next) => {
  try {
    const doc = await Review.findByIdAndUpdate(
      req.params.id,
      { $inc: { helpfulVotes: 1 } },
      { new: true },
    );
    if (!doc) throw new HttpError(404, 'REVIEW_NOT_FOUND', 'Review not found.');
    res.json({ id: String(doc._id), helpfulVotes: doc.helpfulVotes });
  } catch (err) {
    next(err);
  }
});

/* -------------------------------------------------------------------------- */
/* Wishlist (embedded on user document — Database.md §3.1)                    */
/* -------------------------------------------------------------------------- */

wishlistRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user!.sub).select('wishlist').lean();
    res.json({ data: user?.wishlist ?? [] });
  } catch (err) {
    next(err);
  }
});

const AddWishlistBody = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
});

wishlistRouter.post('/', requireAuth, validate(AddWishlistBody), async (req, res, next) => {
  try {
    const body = req.body as z.infer<typeof AddWishlistBody>;
    await User.updateOne(
      { _id: req.user!.sub },
      {
        $addToSet: {
          wishlist: {
            productId: body.productId,
            variantId: body.variantId,
            addedAt: new Date(),
          },
        },
      },
    );
    res.status(201).json({ status: 'added' });
  } catch (err) {
    next(err);
  }
});

wishlistRouter.delete('/:productId', requireAuth, async (req, res, next) => {
  try {
    await User.updateOne(
      { _id: req.user!.sub },
      { $pull: { wishlist: { productId: req.params.productId } } },
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
