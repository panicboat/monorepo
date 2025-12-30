"use server";

import { identityClient } from "@/lib/rpc";

export async function checkBackendHealth() {
  try {
    const res = await identityClient.healthCheck({});
    console.log("HealthCheck Response:", res);
    return { status: res.status };
  } catch (e: any) {
    console.error("HealthCheck Error:", e);
    return { error: e.message || "Unknown error" };
  }
}
