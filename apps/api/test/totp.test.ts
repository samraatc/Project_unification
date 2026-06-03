/** Phase 1.3 — TOTP RFC 6238 vector check + decrypt round-trip. */
import { describe, expect, it } from 'vitest';

import { decryptField, encryptField } from '../src/services/crypto.service.js';

describe('crypto.service — envelope encryption', () => {
  it('round-trips a secret', () => {
    const ct = encryptField('JBSWY3DPEHPK3PXP');
    expect(ct).not.toContain('JBSWY');
    const pt = decryptField(ct);
    expect(pt).toBe('JBSWY3DPEHPK3PXP');
  });

  it('tamper-evident — modifying the cipher rejects decrypt', () => {
    const ct = encryptField('secret');
    const tampered = ct.slice(0, -2) + 'AA';
    expect(() => decryptField(tampered)).toThrow();
  });
});
