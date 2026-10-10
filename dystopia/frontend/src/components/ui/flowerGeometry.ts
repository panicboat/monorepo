export type FlowerSpread = "up-left" | "up";

export interface PetalPosition {
  x: number;
  y: number;
  labelX: number;
  labelY: number;
}

const ARCS: Record<FlowerSpread, [number, number]> = {
  "up-left": [90, 180],
  up: [135, 45],
};

const PETAL_RADIUS = 26;
const LABEL_GAP = 6;
const LABEL_HALF_WIDTH = 32;
const LABEL_HALF_HEIGHT = 9;

// Adding zero turns the negative zero that rounding can produce into a plain zero.
const toPx = (value: number) => Math.round(value) + 0;

export function petalPositions(count: number, spread: FlowerSpread, radius: number): PetalPosition[] {
  const [start, end] = ARCS[spread];
  return Array.from({ length: count }, (_, i) => {
    const degrees = count === 1 ? (start + end) / 2 : start + ((end - start) * i) / (count - 1);
    const cos = Math.cos((degrees * Math.PI) / 180);
    const sin = Math.sin((degrees * Math.PI) / 180);
    // Labels sit outside the arc so a label never lands on the neighbouring petal.
    const reach = PETAL_RADIUS + LABEL_GAP + Math.abs(cos) * LABEL_HALF_WIDTH + Math.abs(sin) * LABEL_HALF_HEIGHT;
    // The wide trigger sits against the edge of its pane, where a label pushed sideways would leave the screen.
    const label = spread === "up" ? { x: 0, y: -(PETAL_RADIUS + LABEL_GAP + LABEL_HALF_HEIGHT) } : { x: cos * reach, y: -sin * reach };
    return {
      x: toPx(cos * radius),
      y: toPx(-sin * radius),
      labelX: toPx(label.x),
      labelY: toPx(label.y),
    };
  });
}

const CENTER_DEAD_ZONE = 34;
const PETAL_REACH = 60;

export function petalAt(dx: number, dy: number, petals: PetalPosition[]): number {
  if (Math.hypot(dx, dy) < CENTER_DEAD_ZONE) return -1;

  let nearest = -1;
  let nearestDistance = PETAL_REACH;
  petals.forEach((petal, index) => {
    const distance = Math.hypot(dx - petal.x, dy - petal.y);
    if (distance < nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  });
  return nearest;
}
