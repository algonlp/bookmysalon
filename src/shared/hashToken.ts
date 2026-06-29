import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export const hashAdminToken = (plainToken: string): string =>
  createHash('sha256').update(plainToken).digest('hex');

export const isHashedToken = (token: string): boolean =>
  /^[a-f0-9]{64}$/.test(token);

const timingSafeCompare = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a, 'utf-8');
  const bufferB = Buffer.from(b, 'utf-8');

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return timingSafeEqual(bufferA, bufferB);
};

export const hashPassword = (plainPassword: string): string => {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(salt + plainPassword).digest('hex');
  return `${salt}:${hash}`;
};

export const verifyPassword = (plainPassword: string, storedPassword: string): boolean => {
  if (!storedPassword.includes(':')) {
    return false;
  }

  const [salt, storedHash] = storedPassword.split(':');
  const hash = createHash('sha256').update(salt + plainPassword).digest('hex');

  const bufferA = Buffer.from(hash, 'utf-8');
  const bufferB = Buffer.from(storedHash, 'utf-8');

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return timingSafeEqual(bufferA, bufferB);
};

export const verifyAdminToken = (
  plainToken: string,
  storedToken: string
): boolean => {
  if (!isHashedToken(storedToken)) {
    return timingSafeCompare(storedToken, plainToken);
  }

  return timingSafeCompare(hashAdminToken(plainToken), storedToken);
};
