import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Ensure .js imports are handled correctly in TypeScript files
    alias: [
      { find: /^(.*)\.js$/, replacement: '$1' }
    ]
  },
});
