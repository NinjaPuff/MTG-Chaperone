import jwt, { type SignOptions } from 'jsonwebtoken';
import { loadConfig } from '../di/config.js';
import type { AppConfig } from '../di/types.js';

interface JwtPayload {
  userId: string;
  displayName: string;
}

export function createJwt(config: Pick<AppConfig, 'jwtSecret' | 'jwtExpiresIn'>) {
  return {
    signToken(payload: JwtPayload): string {
      return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'] });
    },
    verifyToken(token: string): JwtPayload | null {
      try {
        return jwt.verify(token, config.jwtSecret) as JwtPayload;
      } catch {
        return null;
      }
    },
  };
}

const defaultJwt = createJwt(loadConfig());
export const signToken = defaultJwt.signToken;
export const verifyToken = defaultJwt.verifyToken;
