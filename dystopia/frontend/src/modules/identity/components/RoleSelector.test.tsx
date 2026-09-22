import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RoleSelector } from "./RoleSelector";

describe("RoleSelector", () => {
  it("describes what each role is for", () => {
    const html = renderToStaticMarkup(
      <RoleSelector value={1} onChange={() => {}} />,
    );

    expect(html).toContain("女性と遊びたい方");
    expect(html).toContain("働いて稼ぎたい方");
  });

  it("warns that the role cannot be changed after signup", () => {
    const html = renderToStaticMarkup(
      <RoleSelector value={1} onChange={() => {}} />,
    );

    expect(html).toContain("登録後にゲスト/キャストを変更することはできません");
  });

  it("marks the guest radio as checked when value is 1", () => {
    const html = renderToStaticMarkup(
      <RoleSelector value={1} onChange={() => {}} />,
    );
    const inputs = html.match(/<input[^>]*\/>/g) ?? [];
    const guestInput = inputs.find((tag) => tag.includes('value="1"'));
    const castInput = inputs.find((tag) => tag.includes('value="2"'));

    expect(guestInput).toContain('checked=""');
    expect(castInput).not.toContain('checked=""');
  });

  it("marks the cast radio as checked when value is 2", () => {
    const html = renderToStaticMarkup(
      <RoleSelector value={2} onChange={() => {}} />,
    );
    const inputs = html.match(/<input[^>]*\/>/g) ?? [];
    const guestInput = inputs.find((tag) => tag.includes('value="1"'));
    const castInput = inputs.find((tag) => tag.includes('value="2"'));

    expect(castInput).toContain('checked=""');
    expect(guestInput).not.toContain('checked=""');
  });
});
