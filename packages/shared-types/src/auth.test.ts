import { describe, expect, it } from 'vitest';

import { LoginRequest, Password, SignupRequest } from './auth.js';

describe('Password', () => {
  it('rejects short passwords', () => {
    expect(Password.safeParse('short').success).toBe(false);
  });
  it('accepts strong passwords', () => {
    expect(Password.safeParse('correct-horse-battery-staple').success).toBe(true);
  });
});

describe('SignupRequest', () => {
  it('requires acceptedTermsAt', () => {
    const result = SignupRequest.safeParse({
      email: 'a@b.co',
      password: 'correct-horse-battery-staple',
    });
    expect(result.success).toBe(false);
  });
});

describe('LoginRequest', () => {
  it('accepts optional TOTP', () => {
    const ok = LoginRequest.safeParse({
      email: 'a@b.co',
      password: 'correct-horse-battery-staple',
      totp: '123456',
    });
    expect(ok.success).toBe(true);
  });

  it('rejects non-numeric TOTP', () => {
    const bad = LoginRequest.safeParse({
      email: 'a@b.co',
      password: 'correct-horse-battery-staple',
      totp: 'abcdef',
    });
    expect(bad.success).toBe(false);
  });
});
