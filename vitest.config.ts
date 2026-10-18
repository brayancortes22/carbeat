import { defineConfig } from 'vitest/config';

// Config propia para que los tests no carguen vite.config.ts (que levanta servidores de desarrollo).
export default defineConfig({
  test: {
    include: ['shared/**/*.test.ts', 'server/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
});
