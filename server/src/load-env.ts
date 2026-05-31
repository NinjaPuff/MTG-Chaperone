import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Workspace dev runs with cwd under server/, but secrets live in the repo-root .env.
// override: true so a stale server/.env or shell DATABASE_URL cannot win over root .env.
dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env'),
  override: true,
});
