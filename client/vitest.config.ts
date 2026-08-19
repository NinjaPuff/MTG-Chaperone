import path from 'path';
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    resolve: {
      alias: {
        '@mtg-league/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      clearMocks: true,
      restoreMocks: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    },
  }),
);
