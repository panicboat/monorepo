export type SwipeDirection = "pending" | "horizontal" | "vertical";

const DIRECTION_LOCK_THRESHOLD_PX = 10;

export function classifySwipeDirection(dx: number, dy: number): SwipeDirection {
  if (Math.abs(dx) < DIRECTION_LOCK_THRESHOLD_PX && Math.abs(dy) < DIRECTION_LOCK_THRESHOLD_PX) {
    return "pending";
  }
  return Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
}

export function clampDrawerOffset(baseOffset: number, dx: number, drawerWidth: number): number {
  return Math.min(0, Math.max(-drawerWidth, baseOffset + dx));
}

export function shouldToggleDrawer(dx: number, drawerWidth: number, fromOpen: boolean): boolean {
  if (drawerWidth <= 0) return false;
  const threshold = drawerWidth / 3;
  return fromOpen ? dx < -threshold : dx > threshold;
}
