import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* Add other config options here */
};

export default withSentryConfig(nextConfig, {
  org: "manishorg-f6",
  project: "aidpa-frontend-nextjs",

  // Suppress source map upload logs unless running in CI
  silent: !process.env.CI,

  // Upload a larger set of source maps for prettier stack traces
  widenClientFileUpload: true,

  // Route browser requests to Sentry through Next.js to avoid ad-blockers
  tunnelRoute: "/monitoring",

});

