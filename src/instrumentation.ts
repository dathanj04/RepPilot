import type { Instrumentation } from "next";
import { reportError } from "@/lib/monitoring";

export async function register() {
  // Database setup runs in the build. Doing it again while a page is opening
  // can take the process down before the response is sent.
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  await reportError(error, {
    path: request.path,
    method: request.method,
    route: context.routePath,
    routeType: context.routeType,
  });
};
