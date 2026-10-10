import { describe, expect, it } from "vitest";
import { GET } from "./route";

const get = (variant: string) =>
  GET(new Request(`http://localhost/pwa-icon/${variant}`), { params: Promise.resolve({ variant }) });

async function pngSize(res: Response): Promise<[number, number]> {
  const bytes = new DataView(await res.arrayBuffer());
  return [bytes.getUint32(16), bytes.getUint32(20)];
}

describe("GET /pwa-icon/[variant]", () => {
  it("renders each variant as a PNG of its declared size", async () => {
    for (const [variant, size] of [["192", 192], ["512", 512], ["maskable", 512]] as const) {
      const res = await get(variant);

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      expect(await pngSize(res)).toEqual([size, size]);
    }
  });

  it("answers 404 for a variant that does not exist", async () => {
    expect((await get("1024")).status).toBe(404);
    expect((await get("constructor")).status).toBe(404);
  });
});
