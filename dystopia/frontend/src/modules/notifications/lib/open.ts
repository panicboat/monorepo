export interface NotificationOpenInput {
  profileId: string | null;
  to: string | null;
  selectableProfileIds: string[];
  activeProfileId: string | null;
}

const FALLBACK_DESTINATION = "/notifications";
const PARSE_BASE = "https://app.invalid";

// The URL parser reads a backslash as a slash and drops tabs and newlines, so a prefix check alone lets "/\t/evil.example" through.
function staysOnOrigin(value: string): boolean {
  try {
    return new URL(value, PARSE_BASE).origin === PARSE_BASE;
  } catch {
    // SILENT: A destination the URL parser rejects is treated as outside the app.
    return false;
  }
}

function isAppPath(value: string | null): value is string {
  return !!value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") && staysOnOrigin(value);
}

export function resolveNotificationOpen({ profileId, to, selectableProfileIds, activeProfileId }: NotificationOpenInput) {
  // FALLBACK: Opening the target as a profile other than the receiving one would leave its footprints and reads there.
  if (!profileId || !selectableProfileIds.includes(profileId)) return { switchTo: null, destination: FALLBACK_DESTINATION };
  const switchTo = profileId !== activeProfileId ? profileId : null;
  // FALLBACK: A destination outside the app opens the notification list instead.
  const destination = isAppPath(to) ? to : FALLBACK_DESTINATION;
  return { switchTo, destination };
}
