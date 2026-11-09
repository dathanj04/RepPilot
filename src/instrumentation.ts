import type { Instrumentation } from "next";
import { reportError } from "@/lib/monitoring";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { migrateOnStart } = await import("./instrumentation-node");
    migrateOnStart();
  } catch {
    // A database setup failure must not stop the server from serving pages.
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  await reportError(error, {
    path: request.path,
    method: request.method,
    route: context.routePath,
    routeType: context.routeType,
  });
};
