import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ authFetch: vi.fn() }));
vi.mock("@/lib/auth", () => auth);

const {
  base64UrlToBytes,
  detectPushSupport,
  disablePush,
  enablePush,
  isSubscribedHere,
  resyncPushSubscription,
} = await import("./push");

const AVAILABLE = {
  userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/130",
  platform: "Linux armv8l",
  maxTouchPoints: 5,
  standalone: false,
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
  permission: "default" as NotificationPermission,
};

function fakeSubscription(endpoint = "https://fcm.googleapis.com/fcm/send/a") {
  return {
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: "BKey", auth: "auth" } }),
    unsubscribe: vi.fn(async () => true),
  };
}

function installBrowser({ permission = "granted", existing = null as ReturnType<typeof fakeSubscription> | null } = {}) {
  const calls: string[] = [];
  const created = fakeSubscription();
  const registration = {
    pushManager: {
      getSubscription: vi.fn(async () => existing),
      subscribe: vi.fn<(options: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }) => Promise<typeof created>>(async () => created),
    },
  };
  const serviceWorker = {
    register: vi.fn(async () => {
      calls.push("register");
      return registration;
    }),
    ready: Promise.resolve(registration),
    getRegistration: vi.fn(async () => registration),
  };
  const notification = {
    permission,
    requestPermission: vi.fn(async () => {
      calls.push("requestPermission");
      return permission;
    }),
  };
  vi.stubGlobal("navigator", { userAgent: AVAILABLE.userAgent, platform: AVAILABLE.platform, maxTouchPoints: 5, serviceWorker });
  vi.stubGlobal("Notification", notification);
  vi.stubGlobal("window", { PushManager: function PushManager() {}, Notification: notification, matchMedia: () => ({ matches: false }) });
  return { calls, registration, serviceWorker, created };
}

beforeEach(() => {
  auth.authFetch.mockReset().mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("detectPushSupport", () => {
  it("is available on a browser with the push APIs", () => {
    expect(detectPushSupport(AVAILABLE)).toBe("available");
  });

  it("asks iOS users to add the app to the home screen first", () => {
    const iphone = { ...AVAILABLE, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", hasPushManager: false };
    const ipad = { ...AVAILABLE, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", platform: "MacIntel", maxTouchPoints: 5 };

    expect(detectPushSupport(iphone)).toBe("needs-install");
    expect(detectPushSupport(ipad)).toBe("needs-install");
    expect(detectPushSupport({ ...iphone, standalone: true, hasPushManager: true })).toBe("available");
  });

  it("reports a browser without the push APIs and a denied permission", () => {
    expect(detectPushSupport({ ...AVAILABLE, hasPushManager: false })).toBe("unsupported");
    expect(detectPushSupport(null)).toBe("unsupported");
    expect(detectPushSupport({ ...AVAILABLE, permission: "denied" })).toBe("denied");
  });
});

describe("base64UrlToBytes", () => {
  it("decodes unpadded base64url", () => {
    expect(Array.from(base64UrlToBytes("AQID_-8"))).toEqual([1, 2, 3, 255, 239]);
  });
});

describe("enablePush", () => {
  it("asks for permission before anything else, then subscribes with the key and registers the subscription", async () => {
    const browser = installBrowser();

    expect(await enablePush("AQID_-8")).toBe("subscribed");

    expect(browser.calls).toEqual(["requestPermission", "register"]);
    expect(browser.serviceWorker.register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
    const options = browser.registration.pushManager.subscribe.mock.calls[0][0];
    expect(options.userVisibleOnly).toBe(true);
    expect(Array.from(options.applicationServerKey)).toEqual([1, 2, 3, 255, 239]);
    expect(auth.authFetch).toHaveBeenCalledWith("/api/notifications/push/subscription", {
      method: "POST",
      body: { endpoint: "https://fcm.googleapis.com/fcm/send/a", p256dh: "BKey", auth: "auth" },
    });
  });

  it("registers an existing subscription instead of creating another", async () => {
    const existing = fakeSubscription("https://web.push.apple.com/existing");
    const browser = installBrowser({ existing });

    await enablePush("AQID_-8");

    expect(browser.registration.pushManager.subscribe).not.toHaveBeenCalled();
    expect(auth.authFetch).toHaveBeenCalledWith("/api/notifications/push/subscription", expect.objectContaining({
      body: expect.objectContaining({ endpoint: "https://web.push.apple.com/existing" }),
    }));
  });

  it("stops without registering anything when permission is not granted", async () => {
    const browser = installBrowser({ permission: "denied" });

    expect(await enablePush("AQID_-8")).toBe("denied");

    expect(browser.serviceWorker.register).not.toHaveBeenCalled();
    expect(auth.authFetch).not.toHaveBeenCalled();
  });

  it("reports a dismissed prompt separately and registers nothing", async () => {
    const browser = installBrowser({ permission: "default" });

    expect(await enablePush("AQID_-8")).toBe("dismissed");

    expect(browser.serviceWorker.register).not.toHaveBeenCalled();
    expect(auth.authFetch).not.toHaveBeenCalled();
  });
});

describe("disablePush", () => {
  it("unregisters on the server and keeps the browser subscription for the other profiles", async () => {
    const existing = fakeSubscription();
    installBrowser({ existing });

    await disablePush();

    expect(auth.authFetch).toHaveBeenCalledWith("/api/notifications/push/subscription", {
      method: "DELETE",
      body: { endpoint: "https://fcm.googleapis.com/fcm/send/a" },
    });
    expect(existing.unsubscribe).not.toHaveBeenCalled();
  });

  it("does nothing without a subscription", async () => {
    installBrowser();

    await disablePush();

    expect(auth.authFetch).not.toHaveBeenCalled();
  });
});

describe("isSubscribedHere", () => {
  it("is false without asking the server when the browser holds no subscription", async () => {
    installBrowser();

    expect(await isSubscribedHere()).toBe(false);
    expect(auth.authFetch).not.toHaveBeenCalled();
  });

  it("follows the server's answer for the browser's endpoint", async () => {
    installBrowser({ existing: fakeSubscription() });
    auth.authFetch.mockResolvedValue({ subscribed: true });

    expect(await isSubscribedHere()).toBe(true);
    expect(auth.authFetch).toHaveBeenCalledWith("/api/notifications/push/subscription/status", {
      method: "POST",
      body: { endpoint: "https://fcm.googleapis.com/fcm/send/a" },
    });

    auth.authFetch.mockResolvedValue({ subscribed: false });
    expect(await isSubscribedHere()).toBe(false);
  });
});

describe("resyncPushSubscription", () => {
  it("claims the browser's endpoint for the signed-in account when permission is granted", async () => {
    installBrowser({ existing: fakeSubscription() });

    await resyncPushSubscription();

    expect(auth.authFetch).toHaveBeenCalledWith("/api/notifications/push/claim", {
      method: "POST",
      body: { endpoint: "https://fcm.googleapis.com/fcm/send/a" },
    });
    expect(auth.authFetch).not.toHaveBeenCalledWith("/api/notifications/push/subscription", expect.anything());
  });

  it("does nothing before permission is granted", async () => {
    installBrowser({ permission: "default", existing: fakeSubscription() });

    await resyncPushSubscription();

    expect(auth.authFetch).not.toHaveBeenCalled();
  });

  it("swallows a failed claim", async () => {
    installBrowser({ existing: fakeSubscription() });
    auth.authFetch.mockRejectedValue(new Error("offline"));

    await expect(resyncPushSubscription()).resolves.toBeUndefined();
  });
});
