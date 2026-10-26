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
  const noteOf = (html: string) => /<p class="mt-1 text-xs text-text-secondary">(.*?)<\/p>/.exec(html)?.[1];

  it("starts with followers only for a locked profile", () => {
    profileMock.profile = { isPrivate: true };
    const html = renderToStaticMarkup(<PostComposer onSubmit={async () => {}} />);

    expect(html).toContain(">フォロワーのみ<");
  });

  it("starts with everyone for an open profile", () => {
    profileMock.profile = { isPrivate: false };
    const html = renderToStaticMarkup(<PostComposer onSubmit={async () => {}} />);

    expect(html).toContain(">全員<");
  });

  it("labels the switch with followers only", () => {
    const html = render(false, "private");

    expect(html).toContain('aria-label="フォロワーのみ"');
    expect(html).toContain(">フォロワーのみ<");
    expect(html).not.toContain("非公開");
  });

  it("calls the open side everyone", () => {
    const html = render(false, "public");

    expect(html).toContain('aria-label="フォロワーのみ"');
    expect(html).toContain(">全員<");
    expect(html).not.toContain(">公開<");
  });

  it("explains each visibility the same way with or without the lock", () => {
    for (const locked of [false, true]) {
      expect(noteOf(render(locked, "public"))).toBe("誰でも見られます");
      expect(noteOf(render(locked, "private"))).toBe("あなたとフォロワーだけが見られます");
    }
  });
});
