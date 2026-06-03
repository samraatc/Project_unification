import { createPublicKey } from 'node:crypto';

import { Router } from 'express';

import { getActiveKid, getPublicKeyPem } from '../services/jwt.service.js';

/**
 * `/.well-known/jwks.json` — published JWK set so downstream verifiers (worker,
 * webhook service, third-party tools) can validate access tokens without the
 * private key (Security-Requirements §2). Rotation lands in Phase 1.5.
 */
export const wellKnownRouter: Router = Router();

wellKnownRouter.get('/jwks.json', (_req, res) => {
  const pem = getPublicKeyPem();
  const key = createPublicKey(pem);
  const jwk = key.export({ format: 'jwk' });
  res.json({
    keys: [
      {
        ...jwk,
        kid: getActiveKid(),
        use: 'sig',
        alg: 'RS256',
      },
    ],
  });
});
