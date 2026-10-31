import "dotenv/config";

import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);

// Secrets the tests use to sign Stripe webhooks and call the cron route. Only
// the webhook secret is set, so card payments stay hidden at checkout (no
// Stripe API calls) while webhook handling is still tested.
process.env.STRIPE_WEBHOOK_SECRET ||= "whsec_e2e_test_secret";
process.env.CRON_SECRET ||= "cron_e2e_test_secret";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // Tests run against a production build: `npm run build` first.
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    env: { ...(process.env as Record<string, string>) },
  },
});
