"use server";

import { identityClient } from "@/lib/rpc";

export async function checkBackendHealth() {
  try {
    const res = await identityClient.healthCheck({});
    console.log("HealthCheck Response:", res);
    return { status: res.status };
  } catch (e: unknown) {
    console.error("HealthCheck Error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return { error: message };
  }
}
