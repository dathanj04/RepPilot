import type { NextConfig } from "next";

// Cursor's preview opens the app on *.agent.cvm.dev and forwards the request
// with x-forwarded-host set to *.cursorvm.com. Server Actions reject that
// mismatch unless the browser origin is explicitly allowed. Dev HMR and
// stack-frame requests from the same preview origin are blocked the same way.
// Production does not accept every Cursor preview host. The published app
// still has to accept its own address, because the host proxy's internal
// host header does not match the browser origin on form posts.
const hostedOrigins = ["reppilot.apps.grok.bot", "*.apps.grok.bot"];
const previewOrigins = process.env.NODE_ENV === "production" ? [] : ["**.agent.cvm.dev", "**.cursorvm.com"];
const serverActionOrigins = [...hostedOrigins, ...previewOrigins];

const nextConfig: NextConfig = {
  cacheComponents: true,
  devIndicators: false,
  partialPrefetching: true,
  ...(previewOrigins.length > 0 ? { allowedDevOrigins: previewOrigins } : {}),
  // The dev React debug channel waits on the HMR socket. If that socket
  // cannot upgrade, hydration never finishes and forms fall back to GET.
  experimental: {
    reactDebugChannel: false,
    serverActions: { allowedOrigins: serverActionOrigins },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
