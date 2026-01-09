import { setupWorker } from "msw/browser";
import { handlers as identityHandlers } from "./handlers/identity";
import { handlers as guestHandlers } from "./handlers/guest";
import { handlers as castHandlers } from "./handlers/cast";
import { handlers as chatHandlers } from "./handlers/chat";

export const worker = setupWorker(
  ...identityHandlers,
  ...guestHandlers,
  ...castHandlers,
  ...chatHandlers,
);
