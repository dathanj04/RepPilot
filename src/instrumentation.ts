import type { Instrumentation } from "next";
import { reportError } from "@/lib/monitoring";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { migrateOnStart } = await import("./instrumentation-node");
  await migrateOnStart();
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  await reportError(error, {
    path: request.path,
    method: request.method,
    route: context.routePath,
    routeType: context.routeType,
  });
};
