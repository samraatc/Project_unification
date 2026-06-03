import { randomUUID } from 'node:crypto';

import { MediaAsset, type MediaAssetDoc } from '../../db/models/index.js';
import { HttpError } from '../../middleware/errorHandler.js';
import { loadEnv } from '../../config/env.js';
import { audit } from '../audit.service.js';

/**
 * Media library — pre-signed S3 upload + tag + search.
 *
 * The API never streams the binary; the SPA POSTs directly to S3 with the
 * pre-signed URL, then `confirmUpload` records the resulting object metadata.
 * Real S3 signing wires in Phase 3 (the catalogue PR brings the AWS SDK).
 */

const env = loadEnv();

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/quicktime',
]);
const MAX_BYTES = 100 * 1024 * 1024;

export interface PresignInput {
  tenantId: string;
  actorId: string;
  filename: string;
  mime: string;
  sizeBytes: number;
}

export interface PresignResult {
  uploadUrl: string;
  key: string;
  publicUrl: string;
}

export async function presignUpload(input: PresignInput): Promise<PresignResult> {
  if (!ALLOWED_MIME.has(input.mime)) {
    throw new HttpError(400, 'MIME_NOT_ALLOWED', `Mime type ${input.mime} not allowed.`);
  }
  if (input.sizeBytes > MAX_BYTES) {
    throw new HttpError(413, 'FILE_TOO_LARGE', 'File exceeds 100MB upload limit.');
  }
  const ext = input.filename.includes('.') ? input.filename.split('.').pop() : 'bin';
  const key = `tenants/${input.tenantId}/media/${randomUUID()}.${ext}`;
  // Phase 2.2 — stub. Phase 3 will produce a real `s3.getSignedUrl` against MinIO/S3.
  const uploadUrl = `${process.env.S3_ENDPOINT ?? 'http://localhost:9000'}/${process.env.S3_BUCKET ?? 'unified-dev'}/${key}?stubSig=1`;
  const publicUrl = `${process.env.S3_ENDPOINT ?? 'http://localhost:9000'}/${process.env.S3_BUCKET ?? 'unified-dev'}/${key}`;
  return { uploadUrl, key, publicUrl };
}

export interface ConfirmUploadInput {
  tenantId: string;
  actorId: string;
  key: string;
  mime: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  durationMs?: number;
  tags?: string[];
  altText?: string;
  ip?: string;
  ua?: string;
}

export async function confirmUpload(input: ConfirmUploadInput): Promise<MediaAssetDoc> {
  const asset = await MediaAsset.create({
    tenantId: input.tenantId,
    key: input.key,
    bucket: process.env.S3_BUCKET ?? 'unified-dev',
    mime: input.mime,
    sizeBytes: input.sizeBytes,
    width: input.width,
    height: input.height,
    durationMs: input.durationMs,
    tags: input.tags ?? [],
    altText: input.altText,
    uploadedBy: input.actorId,
  });
  await audit({
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: 'media.uploaded',
    entity: 'MediaAsset',
    entityId: asset._id,
    afterJson: { key: input.key, mime: input.mime, sizeBytes: input.sizeBytes },
    ip: input.ip,
    ua: input.ua,
  });
  return asset;
}

export interface SearchInput {
  tenantId: string;
  query?: string;
  tags?: string[];
  cursor?: string;
  limit: number;
}

export async function searchMedia(input: SearchInput): Promise<{ data: MediaAssetDoc[]; nextCursor: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: any = { tenantId: input.tenantId };
  if (input.tags?.length) filter.tags = { $all: input.tags };
  if (input.query) filter.altText = { $regex: input.query, $options: 'i' };
  if (input.cursor) filter._id = { $lt: input.cursor };
  const docs = await MediaAsset.find(filter)
    .sort({ _id: -1 })
    .limit(input.limit + 1);
  const hasMore = docs.length > input.limit;
  const items = hasMore ? docs.slice(0, input.limit) : docs;
  return {
    data: items,
    nextCursor: hasMore ? String(items[items.length - 1]?._id) : null,
  };
}

void env; // touch env to retain the env-binding side-effect if added later
