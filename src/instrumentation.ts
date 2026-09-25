import type { Instrumentation } from "next";

// Deliberately exclude URL/query, headers, cookies, payload, message and stack.
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  console.error(JSON.stringify({
    event: "request_failed",
    at: new Date().toISOString(),
    error: error instanceof Error ? error.name : "UnknownError",
    method: request.method,
    route: context.routePath,
    kind: context.routeType,
  }));
};
