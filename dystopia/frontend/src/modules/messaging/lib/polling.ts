// Poll rather than hold a stream open: the production function URL buffers a response until it ends, so a stream would deliver nothing.
export const MESSAGING_POLL_INTERVAL_MS = 6_000;
