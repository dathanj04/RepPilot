import type { Instrumentation } from "next";
import { reportError } from "@/lib/monitoring";

export async function register() {
  // Sentry and the alert webhook send only when their environment variables are set.
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  await reportError(error, {
    path: request.path,
    method: request.method,
    route: context.routePath,
    routeType: context.routeType,
  });
};
