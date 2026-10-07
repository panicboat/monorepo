import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PasswordRequirements } from "./PasswordRequirements";

describe("PasswordRequirements", () => {
  it("states the minimum length the user pool enforces", () => {
    const html = renderToStaticMarkup(<PasswordRequirements id="hint" />);

    expect(html).toContain("12 文字以上");
  });

  it("names every character class the user pool requires", () => {
    const html = renderToStaticMarkup(<PasswordRequirements id="hint" />);

    expect(html).toContain("大文字");
    expect(html).toContain("小文字");
    expect(html).toContain("数字");
    expect(html).toContain("記号");
  });

  it("carries the given id so a password input can reference it", () => {
    const html = renderToStaticMarkup(
      <PasswordRequirements id="signup-password-requirements" />,
    );

    expect(html).toContain('id="signup-password-requirements"');
  });
});
