import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            // server-only throws outside the react-server condition
            'server-only': fileURLToPath(
                new URL('./node_modules/server-only/empty.js', import.meta.url),
            ),
        },
    },
    test: {
        include: ['src/**/*.test.ts'],
        env: { API_BASE_URL: 'https://api.test' },
    },
});
