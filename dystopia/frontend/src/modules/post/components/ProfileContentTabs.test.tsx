import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileContentTabs } from "./ProfileContentTabs";

describe("ProfileContentTabs", () => {
  it("shows the likes tab on your own profile", () => {
    const html = renderToStaticMarkup(<ProfileContentTabs accountId="account-1" isOwnProfile />);

    expect(html).toContain("いいね");
  });

  it("hides the likes tab on someone else's profile", () => {
    const html = renderToStaticMarkup(<ProfileContentTabs accountId="account-1" isOwnProfile={false} />);

    expect(html).not.toContain("いいね");
  });

  it("defaults to showing the likes tab when isOwnProfile is not passed", () => {
    const html = renderToStaticMarkup(<ProfileContentTabs accountId="account-1" />);

    expect(html).toContain("いいね");
  });
});
