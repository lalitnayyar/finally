import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  timeout: 45000,
  retries: 1,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8000',
    headless: true,
    ignoreHTTPSErrors: true,
    launchOptions: {
      args: ['--no-proxy-server'],
    },
  },
});
