import type { NextConfig } from "next";

// Cursor's preview opens the app on *.agent.cvm.dev and forwards the request
// with x-forwarded-host set to *.cursorvm.com. Server Actions reject that
// mismatch unless the browser origin is explicitly allowed. Dev HMR and
// stack-frame requests from the same preview origin are blocked the same way.
// Production does not accept every Cursor preview host. Local preview still does.
const cursorPreviewOrigins = process.env.NODE_ENV === "production" ? [] : ["**.agent.cvm.dev", "**.cursorvm.com"];

const nextConfig: NextConfig = {
  cacheComponents: true,
  devIndicators: false,
  partialPrefetching: true,
  ...(cursorPreviewOrigins.length > 0 ? { allowedDevOrigins: cursorPreviewOrigins } : {}),
  // The dev React debug channel waits on the HMR socket. If that socket
  // cannot upgrade, hydration never finishes and forms fall back to GET.
  experimental: {
    reactDebugChannel: false,
    ...(cursorPreviewOrigins.length > 0 ? { serverActions: { allowedOrigins: cursorPreviewOrigins } } : {}),
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
