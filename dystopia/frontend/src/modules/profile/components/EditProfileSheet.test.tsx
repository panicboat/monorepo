// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({ usePathname: () => "/u/yuna" }));

const authFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/fetch", () => ({ authFetch: authFetchMock }));

const { EditProfileSheet } = await import("./EditProfileSheet");
const { emptyProfileView } = await import("@/modules/profile/lib/mappers");

describe("EditProfileSheet", () => {
  it("offers each industry by its icon and its name to a cast", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(EditProfileSheet, {
          open: true,
          onOpenChange: () => {},
          profile: emptyProfileView("p1"),
          isCast: true,
          onSave: async () => {},
          onSaveMedia: async () => {},
        })
      );
    });
    const options = Array.from(document.querySelectorAll("#industry option"), (option) => option.textContent);

    expect(options).toContain("🚗 デリヘル");
    expect(options).toContain("🛁 ソープ");
    expect(document.querySelector("#website")).toBeNull();
    expect(document.body.textContent).not.toContain("ウェブサイト");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("opens as a sheet that says which profile is being edited", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(
        createElement(EditProfileSheet, {
          open: true,
          onOpenChange: () => {},
          profile: { ...emptyProfileView("p1"), displayName: "ゆな", username: "yuna" },
          isCast: true,
          onSave: async () => {},
          onSaveMedia: async () => {},
        })
      );
    });

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("プロフィールを編集");
    expect(document.body.textContent).toContain("ゆなとして編集中");
    expect(document.body.textContent).toContain("@yuna");
  });

  it("saves the payload and then closes the sheet", async () => {
    const calls: string[] = [];
    const onSave = vi.fn(async () => {
      calls.push("save");
    });
    const onOpenChange = vi.fn((open: boolean) => {
      calls.push(`open:${open}`);
    });
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(
        createElement(EditProfileSheet, {
          open: true,
          onOpenChange,
          profile: { ...emptyProfileView("p1"), displayName: "ゆな", username: "yuna" },
          isCast: false,
          onSave,
          onSaveMedia: async () => {},
        })
      );
    });

    await act(async () => {
      (Array.from(document.querySelectorAll("button")).filter((b) => b.textContent === "保存").at(-1) as HTMLButtonElement).click();
    });

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ username: "yuna", displayName: "ゆな" }));
    expect(calls).toEqual(["save", "open:false"]);
  });

  async function renderSheet(onSave: (payload: unknown) => Promise<void>) {
    document.body.innerHTML = "";
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(
        createElement(EditProfileSheet, {
          open: true,
          onOpenChange: () => {},
          profile: { ...emptyProfileView("p1"), displayName: "ゆな", username: "yuna" },
          isCast: false,
          onSave,
          onSaveMedia: async () => {},
        })
      );
    });
  }

  async function typeUsername(value: string) {
    const input = document.querySelector("#username") as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 450));
    });
  }

  const saveButton = () =>
    Array.from(document.querySelectorAll("button")).filter((b) => b.textContent === "保存").at(-1) as HTMLButtonElement;

  it("saves a new username once it is available", async () => {
    authFetchMock.mockResolvedValue({ available: true, message: "" });
    const onSave = vi.fn(async () => {});
    await renderSheet(onSave);

    await typeUsername("yuna_new");
    await act(async () => saveButton().click());

    expect(authFetchMock).toHaveBeenCalledWith("/api/profile/username-check?username=yuna_new", { method: "GET" });
    expect(document.body.textContent).toContain("使用できます");
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ username: "yuna_new" }));
  });

  it("blocks saving a username that is taken", async () => {
    authFetchMock.mockResolvedValue({ available: false, message: "このユーザー名は使われています" });
    await renderSheet(async () => {});

    await typeUsername("taken");

    expect(document.body.textContent).toContain("このユーザー名は使われています");
    expect(saveButton().disabled).toBe(true);
  });

  it("turns on follow approval together with the lock", async () => {
    const onSave = vi.fn(async () => {});
    await renderSheet(onSave);

    await act(async () => (document.querySelector('[aria-label="プロフィールに鍵をかける"]') as HTMLButtonElement).click());
    await act(async () => saveButton().click());

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ isPrivate: true, followApprovalRequired: true }));
  });

  it("keeps follow approval on when the lock is turned off", async () => {
    const onSave = vi.fn(async () => {});
    document.body.innerHTML = "";
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(
        createElement(EditProfileSheet, {
          open: true,
          onOpenChange: () => {},
          profile: { ...emptyProfileView("p1"), displayName: "ゆな", username: "yuna", isPrivate: true, followApprovalRequired: true },
          isCast: false,
          onSave,
          onSaveMedia: async () => {},
        })
      );
    });

    await act(async () => (document.querySelector('[aria-label="プロフィールに鍵をかける"]') as HTMLButtonElement).click());
    await act(async () => saveButton().click());

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ isPrivate: false, followApprovalRequired: true }));
  });

  it("explains that the lock shows a mark and that each post's visibility decides who sees it", async () => {
    await renderSheet(vi.fn(async () => {}));

    expect(document.body.textContent).toContain(
      "プロフィールに鍵マークが付き、フォローが承認制になります。投稿を見られる人は、投稿ごとの公開範囲で決まります"
    );
  });

  it("saves the follow approval setting of the profile", async () => {
    const onSave = vi.fn(async () => {});
    await renderSheet(onSave);

    await act(async () => (document.querySelector('[aria-label="フォローを承認制にする"]') as HTMLButtonElement).click());
    await act(async () => saveButton().click());

    expect(document.body.textContent).toContain("フォローされる前に、あなたが承認します");
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ followApprovalRequired: true, isPrivate: false }));
  });

  it("keeps the current follow approval setting when other fields change", async () => {
    const onSave = vi.fn(async () => {});
    document.body.innerHTML = "";
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(
        createElement(EditProfileSheet, {
          open: true,
          onOpenChange: () => {},
          profile: { ...emptyProfileView("p1"), displayName: "ゆな", username: "yuna", followApprovalRequired: true },
          isCast: false,
          onSave,
          onSaveMedia: async () => {},
        })
      );
    });

    await act(async () => (document.querySelector('[aria-label="プロフィールに鍵をかける"]') as HTMLButtonElement).click());
    await act(async () => saveButton().click());

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ isPrivate: true, followApprovalRequired: true }));
  });

  it("sends the unchanged approval setting even when it is off", async () => {
    const onSave = vi.fn(async () => {});
    await renderSheet(onSave);

    await act(async () => saveButton().click());

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ followApprovalRequired: false }));
  });
});

describe("EditProfileSheet main area", () => {
  async function choose(selector: string, value: string) {
    const select = document.querySelector(selector) as HTMLSelectElement;
    await act(async () => {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  it("offers the areas of the chosen prefecture, clears the area with the prefecture and saves both", async () => {
    document.body.innerHTML = "";
    const onSave = vi.fn(async () => {});
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(
        createElement(EditProfileSheet, {
          open: true,
          onOpenChange: () => {},
          profile: { ...emptyProfileView("p1"), displayName: "ゆな", username: "yuna", prefecture: "東京都", area: "新宿" },
          isCast: true,
          onSave,
          onSaveMedia: async () => {},
        })
      );
    });

    expect(document.body.textContent).toContain("主要エリア");
    expect((document.querySelector("#area") as HTMLSelectElement).value).toBe("新宿");
    expect(Array.from(document.querySelectorAll("#area option"), (option) => option.textContent)).not.toContain("梅田");

    await choose("#prefecture", "大阪府");
    expect((document.querySelector("#area") as HTMLSelectElement).value).toBe("");
    await choose("#area", "梅田");
    await act(async () => {
      (Array.from(document.querySelectorAll("button")).filter((b) => b.textContent === "保存").at(-1) as HTMLButtonElement).click();
    });

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ prefecture: "大阪府", area: "梅田" }));
  });
});
