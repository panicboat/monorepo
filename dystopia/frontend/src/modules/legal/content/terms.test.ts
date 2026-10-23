import { describe, expect, it } from "vitest";
import type { LegalSection } from "../types";
import { EDITION, EFFECTIVE_DATE, OPERATOR } from "./operator";
import { TERMS } from "./terms";

const HEADINGS = [
  "目的と適用", "定義", "利用資格", "登録", "アカウントの管理", "プロフィール", "投稿等の責任と権利",
  "売春・裏引き・店舗外の取引の禁止", "個人情報の書き込みと晒しの禁止", "カルテ", "クチコミ", "予定と予定検索",
  "DM", "フォロー・ブロック・足跡・通知", "禁止事項", "違反への措置", "権利侵害の申出", "退会",
  "サービスの変更・中断・終了", "免責", "知的財産権と外部リンク", "通知・連絡", "規約の変更", "有料機能",
  "分離可能性", "準拠法と管轄", "運営者",
];

const text = (section: LegalSection) =>
  [section.heading, ...section.paragraphs.flatMap((paragraph) => [paragraph.text, ...(paragraph.items ?? [])])].join("\n");

const article = (number: number) => text(TERMS.sections[number - 1]);

const all = [TERMS.title, TERMS.preamble, ...TERMS.sections.map(text)].join("\n");

describe("TERMS", () => {
  it("has the 27 articles in order", () => {
    expect(TERMS.sections.map((section) => section.heading)).toEqual(HEADINGS);
    expect(TERMS.title).toBe("利用規約");
    expect(TERMS.numbering).toBe("article");
    expect(TERMS.edition).toBe(EDITION);
    expect(TERMS.effectiveDate).toBe(EFFECTIVE_DATE);
  });

  it("defines posts and 裏引き", () => {
    const definitions = article(2);

    expect(definitions).toContain("「投稿等」");
    expect(definitions).toContain("「裏引き」");

    const posts = TERMS.sections[1].paragraphs.flatMap((paragraph) => paragraph.items ?? []).find((item) => item.startsWith("「投稿等」"));
    expect(posts).toBeDefined();
    for (const word of ["コメント", "プロフィール", "カルテ", "クチコミ", "予定", "DM", "画像"]) {
      expect(posts).toContain(word);
    }
  });

  it("puts the responsibility for posts on the user who posted them", () => {
    const responsibility = article(7);

    expect(responsibility).toMatch(/投稿等/);
    expect(responsibility).toMatch(/責任/);
    expect(responsibility).toContain("投稿した利用者");
  });

  it("bans prostitution and 裏引き", () => {
    const ban = article(8);

    expect(ban).toContain("売春");
    expect(ban).toContain("周旋");
    expect(ban).toContain("裏引き");
  });

  it("bans writing other people's personal information", () => {
    const ban = article(9);

    expect(ban).toContain("住所");
    expect(ban).toContain("勤務先");
    expect(ban).toContain("電話番号");
  });

  it("does not exempt the operator from all liability", () => {
    expect(all).toMatch(/故意(?:又は|または)重大な過失/);
    expect(all).not.toMatch(/一切(?:の)?責任を負/);
    expect(all).not.toContain("法律上許される");
    expect(all).not.toContain("法令上許される");
    expect(article(20)).toContain("重大な過失を除く過失");
  });

  it("names the court by the operator's address", () => {
    const court = article(26);

    expect(court).toContain("運営者の住所地を管轄する地方裁判所");
    expect(court).toContain("日本法");
  });

  it("states what stays after deactivation without promising a deletion date", () => {
    const deactivation = article(18);

    expect(deactivation).toContain("カルテ");
    expect(deactivation).toContain("DM");
    expect(all).not.toMatch(/30\s*日/);
  });

  it("shows the operator placeholders", () => {
    const operator = article(27);

    expect(operator).toContain(OPERATOR.name);
    expect(operator).toContain(OPERATOR.address);
    expect(operator).toContain(OPERATOR.contact);
  });

  it("lets karte and reviews be written without breaking the ban on reposting personal information", () => {
    expect(article(9)).toMatch(/第10条と第11条.*カルテやクチコミを書くことは、前項第2号の行為に当たりません/);
  });

  it("allows guiding to the store's booking method in DMs but no other outside service", () => {
    expect(article(13)).toContain("外部の SNS や通話アプリへ誘導すること（第8条第2項の予約の方法の案内を除きます）");
  });

  it("lets the operator read DMs for any request including rights infringement", () => {
    expect(article(13)).toContain("利用者その他の方からの申出（第17条の申出を含みます）");
  });

  it("states what a lock does not hide", () => {
    const profile = article(6);

    expect(profile).toContain("コメント");
    expect(profile).toMatch(/承認制にしていなければ、ブロックの関係にあるプロフィールを除き、どのプロフィールも、フォローするとすぐにフォロワーになり/);
    expect(profile).toContain("「フォロー中」と「フォロワー」の一覧");
  });

  it("applies to visitors who do not register and bans scraping for anyone who accesses the service", () => {
    expect(article(1)).toContain("登録せずに本サービスを閲覧し、または本サービスにアクセスする方にも適用されます");
    expect(article(15)).toContain("利用者その他の本サービスにアクセスする方は、前項第7号から第10号までの行為をしてはいけません");
  });

  it("describes follows and blocks per profile", () => {
    expect(article(2)).toContain("利用者が自分のプロフィールで、他の利用者の特定のプロフィールとの間のやり取りを制限する設定");
    expect(article(14)).toContain("ブロックは、その2つのプロフィールの間でだけ効きます");
  });

  it("keeps a deactivated guest's review rating in the cast's average until deletion", () => {
    expect(article(18)).toMatch(/退会したゲストが書いたクチコミの評価は、第4項の削除が済むまで、対象のキャストの評価の集計（評価の平均、評価した人数および評価済みのクチコミの件数）に含まれます/);
  });

  it("lets the operator restrict access by a non-registered person who does what article 15 paragraph 2 prohibits", () => {
    expect(article(16)).toContain("利用者以外の方が第15条第2項で禁止する行為をしたと判断した場合、その方による本サービスへのアクセスの制限その他の必要な措置をとることができます");
  });

  it("says uploaded image and video files may remain after deactivation", () => {
    expect(article(18)).toContain("そのアカウントでアップロードされた画像と動画のファイル（アバターとカバー画像を含みます）も、残る場合があります");
  });

  it("says a minor's uploaded files may remain, as after deactivation", () => {
    expect(article(3)).toContain("その利用者の情報を削除します。ただし、その利用者のアカウントでアップロードされた画像と動画のファイル（アバターとカバー画像を含みます）は、残る場合があります");
  });

  it("ends the chance to undo a deactivation at the deletion in article 18 paragraph 4", () => {
    expect(article(18)).toContain("ただし、第4項の削除が済んだ後は、退会を取り消すことはできません");
  });

  it("deletes the reviews a profile wrote and the reviews about it when the profile is deleted", () => {
    expect(article(6)).toContain("プロフィールを削除すると、そのプロフィールで書いたクチコミと、そのプロフィールについて書かれたクチコミも削除されます");
  });

  it("limits the guest's view of karte to the service screens", () => {
    expect(article(10)).toContain("本サービス上でカルテを見ることができるのは、キャストだけです");
  });

  it("keeps to the app's words", () => {
    expect(all).not.toContain("出勤");
    expect(all).not.toContain("通報");
  });

  it("leaves the numbering of paragraphs and items to the view", () => {
    for (const section of TERMS.sections) {
      expect(section.heading).not.toMatch(/^第\d+条/);
      for (const paragraph of section.paragraphs) {
        expect(paragraph.text).not.toMatch(/^(?:\d+\.|（\d+）)/);
        if (paragraph.items) {
          expect(paragraph.items.length).toBeGreaterThan(0);
          for (const item of paragraph.items) expect(item).not.toMatch(/^(?:\d+\.|（\d+）)/);
        }
      }
    }
  });
});
