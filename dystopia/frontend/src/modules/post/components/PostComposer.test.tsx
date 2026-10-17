import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const profileMock = vi.hoisted(() => ({ profile: null as { isPrivate: boolean } | null }));
vi.mock("@/modules/profile/hooks", () => ({ useProfile: () => ({ profile: profileMock.profile }) }));
vi.mock("@/modules/profile/components/ActingProfileLabel", () => ({ ActingProfileLabel: () => <span>acting-profile</span> }));

const { PostComposer } = await import("./PostComposer");

describe("PostComposer", () => {
  it("exposes a file input for attaching images and videos", () => {
    const html = renderToStaticMarkup(<PostComposer onSubmit={async () => {}} />);

    expect(html).toContain('type="file"');
    expect(html).toContain('accept="image/*,video/*"');
    expect(html).toContain('multiple=""');
  });

  it("shows which profile the post is written as above the input", () => {
    const html = renderToStaticMarkup(<PostComposer onSubmit={async () => {}} />);

    expect(html.indexOf("acting-profile")).toBeGreaterThanOrEqual(0);
    expect(html.indexOf("acting-profile")).toBeLessThan(html.indexOf("<textarea"));
  });
});

describe("PostComposer visibility", () => {
  const render = (accountPrivate: boolean, visibility: "public" | "private") => {
    profileMock.profile = { isPrivate: accountPrivate };
    return renderToStaticMarkup(<PostComposer onSubmit={async () => {}} initialVisibility={visibility} />);
  };

  it("labels the switch with followers only", () => {
    const html = render(false, "private");

    expect(html).toContain('aria-label="フォロワーのみ"');
    expect(html).toContain(">フォロワーのみ<");
    expect(html).not.toContain("非公開");
  });

  it("explains each visibility for a public account", () => {
    expect(render(false, "public")).toContain("誰でも見られます");
    expect(render(false, "private")).toContain("あなたとフォロワーだけが見られます");
  });

  it("explains each visibility for a private account", () => {
    expect(render(true, "public")).toContain("今は鍵付きのため、フォロワーだけに表示されます。鍵を外すと誰でも見られるようになります");
    expect(render(true, "private")).toContain("あなたとフォロワーだけが見られます。鍵を外してもフォロワーのみのままです");
  });
});
