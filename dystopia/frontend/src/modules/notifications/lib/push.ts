import { authFetch } from "@/lib/auth";

export type PushSupport = "unsupported" | "needs-install" | "denied" | "available";

export interface PushEnvironment {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  standalone: boolean;
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  permission: NotificationPermission | null;
}

const CONFIG_URL = "/api/notifications/push/config";
const SUBSCRIPTION_URL = "/api/notifications/push/subscription";
const STATUS_URL = "/api/notifications/push/subscription/status";
const CLAIM_URL = "/api/notifications/push/claim";
const SERVICE_WORKER_URL = "/sw.js";

export function readPushEnvironment(): PushEnvironment | null {
  if (typeof window === "undefined" || typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & { standalone?: boolean };
  const hasNotification = "Notification" in window;
  return {
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    standalone: nav.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches === true,
    hasServiceWorker: "serviceWorker" in nav,
    hasPushManager: "PushManager" in window,
    hasNotification,
    permission: hasNotification ? Notification.permission : null,
  };
}

// iPadOS reports itself as a Mac, so a touch-capable Mac is treated as an iPad.
export function detectPushSupport(env: PushEnvironment | null): PushSupport {
  if (!env) return "unsupported";
  const isIOS = /iPad|iPhone|iPod/.test(env.userAgent) || (env.platform === "MacIntel" && env.maxTouchPoints > 1);
  if (isIOS && !env.standalone) return "needs-install";
  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification) return "unsupported";
  if (env.permission === "denied") return "denied";
  return "available";
}

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

export async function fetchVapidPublicKey(): Promise<string> {
  const { vapidPublicKey } = await authFetch<{ vapidPublicKey: string }>(CONFIG_URL);
  return vapidPublicKey;
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration ? registration.pushManager.getSubscription() : null;
}

function subscriptionBody(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return { endpoint: json.endpoint ?? "", p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" };
}

export async function enablePush(vapidPublicKey: string): Promise<"subscribed" | "denied" | "dismissed"> {
  // Ask first: Safari only shows the prompt while the tap that started this is still active.
  const permission = await Notification.requestPermission();
  if (permission === "denied") return "denied";
  if (permission !== "granted") return "dismissed";

  await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/" });
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(vapidPublicKey) }));
  await authFetch(SUBSCRIPTION_URL, { method: "POST", body: subscriptionBody(subscription) });
  return "subscribed";
}

export async function disablePush(): Promise<void> {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  // The browser subscription stays: the device's other profiles still receive through it.
  await authFetch(SUBSCRIPTION_URL, { method: "DELETE", body: { endpoint: subscription.endpoint } });
}

export async function isSubscribedHere(): Promise<boolean> {
  const subscription = await currentPushSubscription();
  if (!subscription) return false;
  const { subscribed } = await authFetch<{ subscribed: boolean }>(STATUS_URL, { method: "POST", body: { endpoint: subscription.endpoint } });
  return subscribed;
}

export async function resyncPushSubscription(): Promise<void> {
  if (detectPushSupport(readPushEnvironment()) !== "available" || Notification.permission !== "granted") return;
  try {
    const subscription = await currentPushSubscription();
    if (subscription) await authFetch(CLAIM_URL, { method: "POST", body: { endpoint: subscription.endpoint } });
  } catch {
    // SILENT: The previous owner keeps the subscription until the next launch claims it again.
  }
}
