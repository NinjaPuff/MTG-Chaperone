import { z } from 'zod';
import type { AppConfig } from './types.js';

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  SERVER_PORT: z.coerce.number().int().positive().default(3000),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  JWT_SECRET: z.string().default('dev-secret-change-in-production'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  DISCORD_CLIENT_ID: z.string().optional(),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_CALLBACK_URL: z.string().url().default('http://localhost:3000/api/auth/discord/callback'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().default('http://localhost:3000/api/auth/google/callback'),
});

export function loadConfig(env = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  return {
    nodeEnv: parsed.NODE_ENV,
    serverPort: parsed.SERVER_PORT,
    clientUrl: parsed.CLIENT_URL,
    jwtSecret: parsed.JWT_SECRET,
    jwtExpiresIn: parsed.JWT_EXPIRES_IN,
    discordClientId: parsed.DISCORD_CLIENT_ID,
    discordClientSecret: parsed.DISCORD_CLIENT_SECRET,
    discordCallbackUrl: parsed.DISCORD_CALLBACK_URL,
    googleClientId: parsed.GOOGLE_CLIENT_ID,
    googleClientSecret: parsed.GOOGLE_CLIENT_SECRET,
    googleCallbackUrl: parsed.GOOGLE_CALLBACK_URL,
  };
}
