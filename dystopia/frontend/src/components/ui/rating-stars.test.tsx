import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RatingStars } from "./rating-stars";

const filledWidth = (html: string) => html.match(/width:([\d.]+)%/)?.[1];

describe("RatingStars", () => {
  it("fills the five stars in proportion to the rating", () => {
    expect(filledWidth(renderToStaticMarkup(<RatingStars value={5} />))).toBe("100");
    expect(filledWidth(renderToStaticMarkup(<RatingStars value={4} />))).toBe("80");
    expect(filledWidth(renderToStaticMarkup(<RatingStars value={1} />))).toBe("20");
  });

  it("fills part of a star for a rating between two whole values", () => {
    expect(filledWidth(renderToStaticMarkup(<RatingStars value={4.5} />))).toBe("90");
  });

  it("names the rating out of five for assistive technology", () => {
    const html = renderToStaticMarkup(<RatingStars value={4} />);

    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="5段階中 4.0"');
  });

  it("keeps the fill within the five stars for an out-of-range rating", () => {
    expect(filledWidth(renderToStaticMarkup(<RatingStars value={7} />))).toBe("100");
    expect(filledWidth(renderToStaticMarkup(<RatingStars value={-1} />))).toBe("0");
  });
});
