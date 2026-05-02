import "@/lib/security/server-only";
import { getOptionalEnv, getRequiredEnv } from "@/lib/security/env";

export function getMetaConfig() {
  return {
    appId: getRequiredEnv("META_APP_ID"),
    appSecret: getRequiredEnv("META_APP_SECRET"),
    graphApiVersion: getOptionalEnv("META_GRAPH_API_VERSION") ?? "v21.0",
  };
}