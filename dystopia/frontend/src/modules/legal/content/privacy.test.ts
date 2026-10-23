import { describe, expect, it } from "vitest";
import type { LegalSection } from "../types";
import { EDITION, EFFECTIVE_DATE, OPERATOR } from "./operator";
import { PRIVACY } from "./privacy";

const HEADINGS = [
  "運営者と窓口", "取得する情報", "利用目的", "他の利用者に表示される情報", "第三者への提供",
  "委託と外部への送信", "保存場所と安全管理", "Cookie と端末内の保存", "保存期間と削除", "DM とログ",
  "開示などの請求", "18歳未満の方", "改定",
];

const text = (section: LegalSection) =>
  [section.heading, ...section.paragraphs.flatMap((paragraph) => [paragraph.text, ...(paragraph.items ?? [])])].join("\n");

const section = (number: number) => text(PRIVACY.sections[number - 1]);

const all = [PRIVACY.title, PRIVACY.preamble, ...PRIVACY.sections.map(text)].join("\n");

describe("PRIVACY", () => {
  it("has the 13 sections in order", () => {
    expect(PRIVACY.sections.map((entry) => entry.heading)).toEqual(HEADINGS);
    expect(PRIVACY.title).toBe("プライバシーポリシー");
    expect(PRIVACY.numbering).toBe("section");
    expect(PRIVACY.edition).toBe(EDITION);
    expect(PRIVACY.effectiveDate).toBe(EFFECTIVE_DATE);
  });

  it("names the operator as the contact", () => {
    const contact = section(1);

    expect(contact).toContain(OPERATOR.name);
    expect(contact).toContain(OPERATOR.address);
    expect(contact).toContain(OPERATOR.contact);
  });

  it("lists the phone number and its hash, and says the age answer is not kept", () => {
    const collected = section(2);

    expect(collected).toContain("電話番号");
    expect(collected).toContain("ハッシュ");
    expect(collected).toMatch(/「年齢の確認」への回答は、保存しません/);
  });

  it("limits the fields it does not ask for to registration and lists what inquiries bring in", () => {
    const collected = section(2);

    expect(collected).toContain("登録の際に、メールアドレス、本名および生年月日の入力を求めません");
    expect(collected).not.toMatch(/メールアドレス、本名および生年月日を取得しません/);
    expect(collected).toMatch(/問い合わせ、苦情、申出または第11節の請求を受けた場合/);
    expect(collected).toContain("本人であることや代理の権限を確認するために提出された書類に書かれた情報");
  });

  it("names the processors and the push services abroad", () => {
    const processors = section(6);

    expect(processors).toContain("Amazon Web Services");
    expect(processors).toMatch(/外国にある場合があります/);
    expect(processors).toMatch(/広告[^。]*使っていません/);
  });

  it("says how long the push services hold a notification and that shared devices show it", () => {
    expect(section(6)).toMatch(/最大24時間/);
    expect(section(6)).toContain("他人と共有している端末では、通知の内容が他人に見えることがあります");
  });

  it("keeps data in Tokyo except what the push services hold for delivery", () => {
    expect(section(7)).toContain("東京");
    expect(section(7)).toMatch(/通知の配信サービスは、配信のために、暗号化した通知を一時的に保持します/);
  });

  it("explains that there is no sign-out", () => {
    expect(section(8)).toMatch(/ログアウトの機能がありません/);
  });

  it("states backup and log periods without a deletion date for deactivated accounts", () => {
    const retention = section(9);

    expect(retention).toMatch(/7\s*日/);
    expect(retention).toMatch(/30\s*日/);

    const deactivation = PRIVACY.sections[8].paragraphs
      .map((paragraph) => [paragraph.text, ...(paragraph.items ?? [])].join("\n"))
      .filter((paragraph) => paragraph.includes("退会"));
    expect(deactivation.length).toBeGreaterThan(0);
    for (const paragraph of deactivation) expect(paragraph).not.toMatch(/30\s*日/);
  });

  it("says reviews go with a deleted profile and that karte and DMs stay after deactivation", () => {
    const retention = section(9);

    expect(retention).toContain("プロフィールを削除した場合は、そのプロフィールで書いたクチコミと、そのプロフィールについて書かれたクチコミも削除されます");
    expect(retention).toMatch(/退会したアカウントの情報を削除します。ただし、次の2つの段落に定めるカルテと DM は、退会した後も残ります/);
  });

  it("limits when the operator reads messages", () => {
    expect(section(10)).toContain("申出");
    expect(section(10)).toMatch(/DM の内容を見るのは、利用者その他の方からの申出[^。]*法令にもとづく場合に限ります/);
  });

  it("lists only the log fields recorded now and keeps the IDs optional", () => {
    const fields = PRIVACY.sections[9].paragraphs.find((paragraph) => paragraph.text.includes("次の情報をログに記録します"));

    expect(fields?.items).toEqual(["処理した時刻", "操作の種類", "処理にかかった時間", "処理の結果（エラーの場合は、エラーの内容）"]);
    expect(section(10)).toContain("処理ごとに割り当てる識別子、アカウントの ID およびプロフィールの ID をログに記録することがあります");
  });

  it("lets the person, including one who left, make requests and checks identity without public data", () => {
    const requests = section(11);

    expect(requests).toContain("本人（退会した方を含みます）は、運営者の連絡先に");
    expect(requests).toContain("登録した電話番号の照合など、運営者が定める方法で確認します");
    expect(requests).not.toContain("ユーザー名の照合");
    expect(requests).toContain("カルテとクチコミの内容の訂正の請求には、削除または非表示によって対応することがあります");
  });

  it("tells users individually about changes that greatly harm them", () => {
    expect(section(13)).toContain("利用者の利益を大きく損なう改定は、本サービス上での表示に加えて、個別のお知らせなどの方法でも利用者に伝えます");
  });

  it("keeps to what the code does", () => {
    expect(all).not.toContain("会員限定");
    expect(all).not.toContain("通報");
    expect(all).not.toContain("出勤");
  });

  it("leaves the numbering of headings and items to the view", () => {
    for (const entry of PRIVACY.sections) {
      expect(entry.heading).not.toMatch(/^\d+\./);
      for (const paragraph of entry.paragraphs) {
        expect(paragraph.text).not.toMatch(/^(?:\d+\.|（\d+）)/);
        if (paragraph.items) {
          expect(paragraph.items.length).toBeGreaterThan(0);
          for (const item of paragraph.items) expect(item).not.toMatch(/^(?:\d+\.|（\d+）)/);
        }
      }
    }
  });
});
