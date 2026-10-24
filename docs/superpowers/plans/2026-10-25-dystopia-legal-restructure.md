# Dystopia legal texts restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 利用規約とプライバシーポリシーを、権利・義務と法令が求める事項だけの粒度に書き直し、機能の挙動を変えても直さずに済むようにする。

**Architecture:** 本文は `dystopia/frontend/src/modules/legal/content/` の `LegalDocument` オブジェクト（`terms.ts`・`privacy.ts`）で、`LegalDocumentView` が条・節・項の番号を付けて描画する。
本文中の参照は番号ではなく見出しの名前で書き、`references.test.ts` が参照先の見出しの実在を確かめる。
プライバシーポリシーを先に書き直す（今の利用規約にはプライバシーポリシーへの参照がなく、ポリシーから参照する利用規約の見出しは書き直しの前後で変わらないため）。

**Tech Stack:** Next.js（TypeScript）、vitest、pnpm。

**Spec:** `docs/superpowers/specs/2026-10-24-dystopia-legal-restructure-design.md`

## Global Constraints

- 本文は日本語の丁寧体（です・ます）で書き、語は「運営者」「利用者」「本サービス」を使う。
- 書かないもの（設計書の「What the texts do not state」）: 表示の規則の例外、通知の種類・出方・設定の名前・文字数、画面・ボタン・設定の名前、件数・上限・並び順・プロフィールの数の上限、Cookie や端末内の保存の名前と有効期間、インフラのサービス名と構成、削除の連鎖の細かい範囲。
- 実装の値（有効期間、保存期間、文字数、件数）は書かず、バックアップとログに残る期間は「一定期間」と書く。
  - 期限と年齢で書くのは、18 歳と、サービス終了の告知（1 か月前）だけ。
  - 照会への回答期限（7 日）と、退会から削除までの日数は書かない。
- 条・節は見出しの名前で参照し、番号による参照（第N条、第N項、第N号、第N節、前項、次項）は使わない。
  - 同じ文書の中: 「「退会」の条」「「保存期間と削除」の節」。
  - 文書をまたぐとき: 「利用規約の「退会」の条」「プライバシーポリシーの「保存期間と削除」の節」。
- 同じ規則は 1 か所にだけ書き、もう一方は名前で指す。
  - 退会などの後に残る情報は、プライバシーポリシーの「保存期間と削除」の節に書く。
  - 運営者が DM の内容を確認する場合は、利用規約の「DM」の条に書く。
- 版は「第1版」、施行日は「【施行日】」、運営者の連絡先は「【連絡先】」のまま（`operator.ts`）にする。
- 運営者の氏名と住所は本文に書かず、`OPERATOR_IDENTITY_ON_REQUEST` の文を書く。
- 免責は今の書き方（運営者の故意または重大な過失による損害は賠償する）を保ち、「一切の責任を負いません」とは書かない。
- アプリの語に合わせ、予定（出勤ではなく）、足跡、補足（メモではなく）、「全員」「フォロワーのみ」を使う。
- アプリにない「通報」「非表示」と、運営者から送る手段のない「個別のお知らせ」は書かない。
- テストで固定するのは、設計書の「Tests」に挙げたもの（構成、参照、重要な約束、書かない方針）だけにする。
  - それ以外の文は、Task 4 で実装と設計書に照らして確かめる。
- コミットは `git commit -s` で作り、`Claude-Session: https://claude.ai/code/session_019H47CVsxzYWCvDivkhY6Ki` の行を付け、`Co-Authored-By` は付けない。

## Review Focus

- 見出しを変えた条・節を、別の条・節が名前で参照したままになる。
  - Task 1 の「points every name reference」のテストが落ちる（Task 2・3 の全体テストでも走る）。
- 書き直しの途中で、実装の値（「1時間」「30日」「24時間」「100字」）や、設定・インフラの名前が戻ってくる。
  - Task 2・3 の「leaves out」のテストが落ちる。
- 法令が求める事項（窓口、運営者の氏名・住所の扱い、利用目的、安全管理措置、共有への同意、事業の承継）を書き落とす。
  - 節の並びのテストが節の有無を、Task 4 の照合が中身を確かめる（設計書が文の固定を「Tests」の項目に限るため、中身はテストで固定しない）。
- `/terms` と `/privacy` のページが、最初の見出しを失って壊れる。
  - 既存のページのテスト（「第1条（目的と適用）」「1. 運営者と窓口」）が、Task 2・3 の全体テストで通り続ける。
- 仕様書と README が、古い条番号（「規約第3条第3項」）を指したままになる。
  - Task 3 の grep で確かめる。

---

### Task 1: Name references in the legal texts

**Files:**
- Modify: `dystopia/frontend/src/modules/legal/content/references.test.ts`

**Interfaces:**
- Produces: `references.test.ts` の中の `nameReferences(source: LegalDocument, documents: { terms: LegalDocument; privacy: LegalDocument }): { label: string; resolved: boolean }[]`。
  - 参照は、段落の本文と箇条書きから `/(?:(利用規約|プライバシーポリシー)の)?「([^「」]+)」の(条|節)/g` で拾い、出てきた順に返す。
  - `label` は `${source.title} ${参照を含む条・節の見出し}: ${拾った文字列}`。
- 解決の規則（どれにも当たらなければ `resolved: false`）:
  - `利用規約の「X」の条`: `documents.terms` に見出し X がある。
  - `プライバシーポリシーの「X」の節`: `documents.privacy` に見出し X がある。
  - 文書名のない `「X」の条`: `source.numbering` が `"article"` で、`source` に見出し X がある。
  - 文書名のない `「X」の節`: `source.numbering` が `"section"` で、`source` に見出し X がある。
- 既存の番号の参照の検査（`references` と、それを使う 2 つのテスト）は、Task 3 まで残す。

- [ ] **Step 1: 失敗するテストを書く**

```ts
const fixture = (title: string, numbering: LegalDocument["numbering"], sections: LegalDocument["sections"]): LegalDocument => ({
  title, edition: "第1版", effectiveDate: "【施行日】", numbering, preamble: "", sections,
});

describe("name references", () => {
  it("resolves a reference by heading and rejects a missing heading or the wrong document", () => {
    const terms = fixture("利用規約", "article", [
      { heading: "退会", paragraphs: [{ text: "残る情報は、プライバシーポリシーの「保存期間と削除」の節に定めます。" }] },
      { heading: "利用資格", paragraphs: [{ text: "退会した場合と同じです（「退会」の条）。「存在しない」の条も見ます。「保存期間と削除」の節も見ます。" }] },
    ]);
    const privacy = fixture("プライバシーポリシー", "section", [
      { heading: "保存期間と削除", paragraphs: [{ text: "利用規約の「退会」の条に定めるとおりです。" }] },
    ]);
    const documents = { terms, privacy };

    expect(nameReferences(terms, documents)).toEqual([
      { label: "利用規約 退会: プライバシーポリシーの「保存期間と削除」の節", resolved: true },
      { label: "利用規約 利用資格: 「退会」の条", resolved: true },
      { label: "利用規約 利用資格: 「存在しない」の条", resolved: false },
      { label: "利用規約 利用資格: 「保存期間と削除」の節", resolved: false },
    ]);
    expect(nameReferences(privacy, documents)).toEqual([
      { label: "プライバシーポリシー 保存期間と削除: 利用規約の「退会」の条", resolved: true },
    ]);
  });

  it("points every name reference in the terms and the privacy policy at an existing heading", () => {
    const documents = { terms: TERMS, privacy: PRIVACY };
    const unresolved = [...nameReferences(TERMS, documents), ...nameReferences(PRIVACY, documents)].filter((reference) => !reference.resolved);

    expect(unresolved.map((reference) => reference.label)).toEqual([]);
  });
});
```

- [ ] **Step 2: テストが失敗することを確かめる**

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/legal/content/references.test.ts`
Expected: FAIL（`nameReferences is not defined`）

- [ ] **Step 3: `nameReferences` を `references.test.ts` に実装する**

- [ ] **Step 4: テストが通ることを確かめる**

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/legal`
Expected: PASS（今の本文には名前の参照がないため、2 つ目のテストも通る）

- [ ] **Step 5: コミットする**

```bash
git add dystopia/frontend/src/modules/legal/content/references.test.ts
git commit -s -m "test(dystopia): check references to legal articles and sections by heading" -m "Claude-Session: https://claude.ai/code/session_019H47CVsxzYWCvDivkhY6Ki"
```

---

### Task 2: Rewrite the privacy policy

**Files:**
- Modify: `dystopia/frontend/src/modules/legal/content/operator.ts`
- Rewrite: `dystopia/frontend/src/modules/legal/content/privacy.ts`
- Rewrite: `dystopia/frontend/src/modules/legal/content/privacy.test.ts`
- Modify: `dystopia/frontend/src/modules/legal/content/references.test.ts`

**Interfaces:**
- Consumes: Task 1 の `nameReferences`。
- Produces: `operator.ts` の `export const OPERATOR_IDENTITY_ON_REQUEST = "運営者の氏名または名称および住所（法人の場合は、代表者の氏名を含みます）は、運営者の連絡先に請求があった場合に、遅滞なく回答します。";`
- Produces: プライバシーポリシーの見出し（この順、14 節）。Task 3 の利用規約は「保存期間と削除」を名前で参照する。

```ts
const HEADINGS = [
  "運営者と窓口", "取得する情報", "利用目的", "他の利用者に表示される情報", "カルテ・クチコミ・足跡の共有",
  "第三者への提供", "委託と外部への送信", "保存場所と安全管理", "Cookie と端末内の保存", "保存期間と削除",
  "DM とログ", "開示などの請求", "18歳未満の方", "改定",
];
```

- 利用規約の条を参照するときは、今の `terms.ts` と Task 3 の利用規約の両方にある見出しだけを使う（「フォロー・ブロック・足跡・通知」と「個人情報の取扱い」は参照しない）。

- [ ] **Step 1: 失敗するテストを書く（`privacy.test.ts` を置き換える）**

今のファイルの `text`・`all` と、「leaves the numbering of headings and items to the view」のテストは残す。
`section` は見出しで引く形にし、`OPERATOR_IDENTITY_ON_REQUEST` を `./operator` から読み込む。

```ts
const section = (heading: string) => text(PRIVACY.sections.find((entry) => entry.heading === heading)!);

it("has the sections in order", () => {
  expect(PRIVACY.sections.map((entry) => entry.heading)).toEqual(HEADINGS);
  expect(PRIVACY.title).toBe("プライバシーポリシー");
  expect(PRIVACY.numbering).toBe("section");
  expect(PRIVACY.edition).toBe(EDITION);
  expect(PRIVACY.effectiveDate).toBe(EFFECTIVE_DATE);
});

it("names the contact and answers the operator's identity on request", () => {
  expect(section("運営者と窓口")).toContain(OPERATOR.contact);
  expect(section("運営者と窓口")).toContain(OPERATOR_IDENTITY_ON_REQUEST);
  expect(all).not.toContain("【運営者氏名】");
  expect(all).not.toContain("【住所】");
});

it("keeps the phone number and the password out of the database", () => {
  expect(section("取得する情報")).toContain("電話番号、ハッシュ値、パスワードおよびパスワードを確認するための情報は、いずれも、本サービスのデータベースには保存しません。");
});

it("shows the karte to every cast and not to the guest it is about", () => {
  expect(section("カルテ・クチコミ・足跡の共有")).toContain("カルテの内容（評価、段階、結果、タグ、補足および日付）、書いたキャストと対象のゲストのプロフィールの情報、および対象のゲストについてのカルテの評価の集計は、すべてのキャストに表示されます。");
  expect(section("カルテ・クチコミ・足跡の共有")).toContain("ゲストには、本サービス上では、自分についてのカルテも表示されません。");
});

it("lets the operator read DMs only in the cases the terms set", () => {
  expect(section("DM とログ")).toContain("運営者が DM の内容を確認するのは、利用規約の「DM」の条に定める場合に限ります。");
});

it("keeps the karte, delivered DMs and reviews after deactivation and deletions", () => {
  const remaining = PRIVACY.sections.find((entry) => entry.heading === "保存期間と削除")!.paragraphs.find((paragraph) => paragraph.text.includes("次の情報は残ります"));

  expect(remaining?.text).toBe("利用者が退会し、プロフィールを削除し、または運営者が利用者のアカウントを削除した場合（「18歳未満の方」の節の場合と、利用規約の「違反への措置」の条の場合）も、その利用者またはそのプロフィールに関係する次の情報は残ります。この場合、その利用者またはそのプロフィールの表示名、ユーザー名、アバターなどの情報は、表示されなくなります。");
  expect(remaining?.items).toEqual([
    "カルテ",
    "相手に届いた DM",
    "クチコミ（クチコミの評価は、対象のキャストの評価の集計に含まれたままです）",
  ]);
});

it("does not use ad or analytics tools", () => {
  expect(all).toContain("運営者は、広告を配信するツールと、アクセスを解析するツールを使っていません。");
});

it("leaves out implementation values, setting and infrastructure names, and words the app does not use", () => {
  expect(all).not.toMatch(/[0-9０-９]+\s*(?:日|時間|字)/);
  for (const word of ["出勤", "通報", "メモ", "非表示", "個別のお知らせ", "この端末で受け取る", "他人のプロフィール訪問時に足跡を残す", "localStorage", "AWS", "Amazon", "東京リージョン"]) {
    expect(all).not.toContain(word);
  }
});
```

- [ ] **Step 2: テストが失敗することを確かめる**

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/legal/content/privacy.test.ts`
Expected: FAIL（`OPERATOR_IDENTITY_ON_REQUEST` がなく、節の並びも合わない）

- [ ] **Step 3: `operator.ts` に `OPERATOR_IDENTITY_ON_REQUEST` を足す**

`OPERATOR` の `name` と `address` は、今の利用規約が使っているため、Task 3 まで残す。

- [ ] **Step 4: `privacy.ts` を書き直す**

設計書の「Structure > Privacy policy」と「Legal requirements」に従い、次の点はこの計画で決めたとおりに書く。
- 前文は運営者を「本サービスの運営者（以下「運営者」といいます）」と書き、`OPERATOR.name` と `OPERATOR.address` を使わない。
- 「保存場所と安全管理」の節に、サーバーが日本国内にあることと、クラウドのサービスを提供する事業者が米国にあることを書く。
  - 本番のアカウントの請求書の発行元は Amazon Web Services, Inc. だった（2026-10-25 に `aws invoicing list-invoice-summaries` で、2026 年 9 月分の請求書を確認）。
  - サービス名（AWS など）は書かない。
- 「保存期間と削除」の節では、退会したアカウントの情報の削除を利用規約の「退会」の条で指し、退会の取り消しは書かない。
- 「開示などの請求」の節では、カルテとクチコミの訂正の請求に「削除によって対応することがあります」と書く（#1721）。
- 「改定」の節では、改定の内容と効力が生じる日を事前に本サービス上で知らせることと、法令上同意が必要な改定では同意を得ることを書く（#1716、#1723）。
- 「取得する情報」の節では、画像の撮影場所などの情報を端末で取り除くことと、動画からは取り除けない場合があることを書く（#1718）。

- [ ] **Step 5: `references.test.ts` で、プライバシーポリシーの番号の参照をなくす**

`finds the references of every form` の期待値から、プライバシーポリシーの 3 つ（`"プライバシーポリシー 第1節: 第11節"`、`"プライバシーポリシー 第9節: 利用規約第18条第2項"`、`"プライバシーポリシー 第11節: 利用規約第10条第5項および第11条第5項"`）を外す。
番号による参照がないことを確かめるテストを足す（Task 3 で `TERMS` を加える）。

```ts
it("refers to articles and sections by heading, not by number", () => {
  const NUMBER = /前項|次項|第[0-9０-９一二三四五六七八九十]+[条項号節]/;
  const texts = [PRIVACY].flatMap((document) =>
    document.sections.flatMap((section) => section.paragraphs.flatMap((paragraph) => [paragraph.text, ...(paragraph.items ?? [])])),
  );

  expect(texts.filter((text) => NUMBER.test(text))).toEqual([]);
});
```

- [ ] **Step 6: テストと検査を通す**

Run: `cd dystopia/frontend && pnpm exec vitest run && pnpm exec tsc --noEmit --incremental false`
Expected: すべての test file が PASS（`/privacy` のページのテストの「1. 運営者と窓口」を含む）、tsc は終了コード 0

Run: `git diff --check`
Expected: 出力なし

- [ ] **Step 7: コミットする**

```bash
git add dystopia/frontend/src/modules/legal/content
git commit -s -m "feat(dystopia): rewrite the privacy policy around what the law requires and what users rely on" -m "Claude-Session: https://claude.ai/code/session_019H47CVsxzYWCvDivkhY6Ki"
```

---

### Task 3: Rewrite the terms

**Files:**
- Rewrite: `dystopia/frontend/src/modules/legal/content/terms.ts`
- Rewrite: `dystopia/frontend/src/modules/legal/content/terms.test.ts`
- Modify: `dystopia/frontend/src/modules/legal/content/operator.ts`
- Modify: `dystopia/frontend/src/modules/legal/content/references.test.ts`
- Modify: `dystopia/docs/features/account.md:86`、`dystopia/lambda/README.md:100`

**Interfaces:**
- Consumes: Task 1 の `nameReferences`、Task 2 の `OPERATOR_IDENTITY_ON_REQUEST` と、プライバシーポリシーの見出し「保存期間と削除」。
- Produces: 利用規約の見出し（この順、28 条）。Task 2 のプライバシーポリシーは、このうち「DM」「退会」「違反への措置」などを名前で参照している。

```ts
const HEADINGS = [
  "目的と適用", "定義", "利用資格", "登録", "アカウントの管理", "プロフィール", "投稿等の責任と権利",
  "売春・裏引き・店舗外の取引の禁止", "個人情報の書き込みと晒しの禁止", "カルテ", "クチコミ", "予定と予定検索",
  "DM", "フォロー・ブロック・足跡", "禁止事項", "違反への措置", "権利侵害の申出", "退会",
  "サービスの変更・中断・終了", "個人情報の取扱い", "免責", "知的財産権と外部リンク", "通知・連絡", "規約の変更",
  "有料機能", "分離可能性", "準拠法と管轄", "運営者",
];
```

- [ ] **Step 1: 失敗するテストを書く（`terms.test.ts` を置き換える）**

今のファイルの `text`・`all` と、「leaves the numbering of paragraphs and items to the view」のテストは残す。
`article` は見出しで引く形にし、`OPERATOR_IDENTITY_ON_REQUEST` を `./operator` から読み込む。

```ts
const article = (heading: string) => text(TERMS.sections.find((entry) => entry.heading === heading)!);

it("has the articles in order", () => {
  expect(TERMS.sections.map((entry) => entry.heading)).toEqual(HEADINGS);
  expect(TERMS.title).toBe("利用規約");
  expect(TERMS.numbering).toBe("article");
  expect(TERMS.edition).toBe(EDITION);
  expect(TERMS.effectiveDate).toBe(EFFECTIVE_DATE);
});

it("names the contact and answers the operator's identity on request", () => {
  expect(article("運営者")).toContain(OPERATOR.contact);
  expect(article("運営者")).toContain(OPERATOR_IDENTITY_ON_REQUEST);
  expect(all).not.toContain("【運営者氏名】");
  expect(all).not.toContain("【住所】");
});

it("limits use to people aged 18 or over who are not high school students", () => {
  expect(article("利用資格")).toContain("本サービスを利用できるのは、18歳以上の方に限ります。18歳以上であっても、高校生の方は利用できません。");
});

it("shows the karte to casts only", () => {
  expect(article("カルテ")).toContain("カルテは、すべてのキャストで共有されます。本サービス上でカルテを見ることができるのは、キャストだけです。ゲストは、自分についてのカルテも見ることができません。");
});

it("lets the operator read DMs only on requests and under the law, with the user's consent", () => {
  expect(article("DM")).toContain("運営者は、利用者その他の方からの申出に対応する場合と、法令にもとづく場合に限り、DM の内容を確認します。利用者は、運営者がこれらの場合に DM の内容を確認することに同意します。");
});

it("leaves what remains after deactivation to the privacy policy", () => {
  expect(article("退会")).toContain("退会した後も残る情報は、プライバシーポリシーの「保存期間と削除」の節に定めます。");
});

it("leaves out implementation values and words the app does not use", () => {
  expect(all).not.toMatch(/[0-9０-９]+\s*(?:日|時間|字)/);
  for (const word of ["出勤", "通報", "メモ", "非表示", "個別のお知らせ", "別に定めるルール"]) {
    expect(all).not.toContain(word);
  }
});
```

- [ ] **Step 2: テストが失敗することを確かめる**

Run: `cd dystopia/frontend && pnpm exec vitest run src/modules/legal/content/terms.test.ts`
Expected: FAIL（条の並びが合わず、固定した文が見つからない）

- [ ] **Step 3: `terms.ts` を書き直す**

設計書の「Structure > Terms」に従い、次の点はこの計画で決めたとおりに書く。
- 前文は運営者を「本サービスの運営者（以下「運営者」といいます）」と書き、`OPERATOR.name` を使わない。
- 「目的と適用」に、運営者が別に定めるルールを規約の一部とする文を書かない。
- 「登録」に、登録できるアカウントは 1 人につき 1 つであることを書く（#1725）。
- 「違反への措置」に、措置としてアカウントを削除した場合に残る情報は、退会した場合と同じであることを書く。
- 「権利侵害の申出」では、投稿した利用者に意見を照会することが「あります」と書き、回答期限は書かない（#1716）。
- 「サービスの変更・中断・終了」に、事業を承継させる場合に、規約上の地位と、利用者の情報を含む権利と義務を承継先に移せることを書く。
- 「個人情報の取扱い」に、利用者の情報をプライバシーポリシーに従って扱うことと、規約への同意によってその取扱いに同意することを書く。
- 「通知・連絡」と「規約の変更」では、知らせる方法を「本サービス上での表示その他の運営者が適当と認める方法」とし、個別のお知らせは書かない（#1716）。
- 「運営者」に、`連絡先：${OPERATOR.contact}` と `OPERATOR_IDENTITY_ON_REQUEST` を書く。
- 今の本文のうち、設計書が残すとした文（禁止事項の一覧、売春・裏引きの禁止の一覧と例外、免責、準拠法と管轄など）は、言い回しを保ってよい。

- [ ] **Step 4: `operator.ts` から `OPERATOR.name` と `OPERATOR.address` を外す**

`OPERATOR` は `contact` だけになる。

- [ ] **Step 5: `references.test.ts` から番号の参照の検査を外す**

`REFERENCE`・`PART`・`Reference`・`exists`・`sectionName`・`references`・`all` と、それを使う 2 つのテスト（`finds the references of every form`・`points every reference at an existing article, paragraph, item or section`）を消す。
Task 2 で足したテストの `[PRIVACY]` を `[TERMS, PRIVACY]` にする。

- [ ] **Step 6: 仕様書と README の条番号を直す**

`dystopia/docs/features/account.md:86` と `dystopia/lambda/README.md:100` の「規約第3条第3項」を「規約の「利用資格」の条」に変える。

- [ ] **Step 7: テストと検査を通す**

Run: `cd dystopia/frontend && pnpm exec vitest run && pnpm exec tsc --noEmit --incremental false`
Expected: すべての test file が PASS（`/terms` のページのテストの「第1条（目的と適用）」を含む）、tsc は終了コード 0

Run: `grep -rnE '(規約|ポリシー)の?第[0-9０-９]+[条節]' dystopia --include=*.md --include=*.ts --include=*.tsx | grep -v node_modules`
Expected: 出力なし

Run: `git diff --check`
Expected: 出力なし

- [ ] **Step 8: コミットする**

```bash
git add dystopia/frontend/src/modules/legal/content dystopia/docs/features/account.md dystopia/lambda/README.md
git commit -s -m "feat(dystopia): rewrite the terms around rights, duties and what users can expect" -m "Claude-Session: https://claude.ai/code/session_019H47CVsxzYWCvDivkhY6Ki"
```

---

### Task 4: Verify the rewritten texts against the implementation and the spec

subagent-driven で実行する場合も、この Task はコントローラーが行う（レビュー担当を立てるため）。

**Files:**
- Modify: `dystopia/frontend/src/modules/legal/content/terms.ts`、`privacy.ts`（報告があれば）と、固定した文を変える場合はそのテスト

**Interfaces:**
- Consumes: Task 2・3 の本文。

- [ ] **Step 1: 読むだけのレビュー担当を 2 つ立てる（利用規約に 1 つ、プライバシーポリシーに 1 つ）**

渡す指示:
- 対象のファイルの文を 1 つずつ読み、今のコード（`dystopia/monolith`、`dystopia/frontend/src`、`dystopia/lambda`）で正しいかを確かめる。
- 設計書の次の項目が、対象の文書に書かれているかを確かめる。
  - 「Structure」の、その文書の各条・各節の項目。
  - 「Legal requirements」の「What the texts must contain」と「Decisions on unclear points」。
  - 「Issues」の「書き直し後」の列。
- この計画の Global Constraints に反する文を探す。
- 報告するのは、実装と食い違う文、誤解を招く文、書き落とした項目、Global Constraints に反する文だけにする。
  - 根拠は開いたファイルの `path:line` で示し、最小の直し方を添える。
  - 言い回しの好みは報告しない。
- ファイルは変更しない。

- [ ] **Step 2: 報告された点を直す**

テストで固定した文を変えるときは、先にテストを直して失敗を確かめてから本文を直す。

- [ ] **Step 3: 新しいレビュー担当で Step 1 をやり直し、報告が 0 件になったら終える**

- [ ] **Step 4: テストを通す**

Run: `cd dystopia/frontend && pnpm exec vitest run && pnpm exec tsc --noEmit --incremental false`
Expected: すべての test file が PASS、tsc は終了コード 0

- [ ] **Step 5: 直した場合はコミットする**

```bash
git add dystopia/frontend/src/modules/legal/content
git commit -s -m "fix(dystopia): match the rewritten legal texts to the implementation" -m "Claude-Session: https://claude.ai/code/session_019H47CVsxzYWCvDivkhY6Ki"
```

---

### Task 5: Open the pull request

**Files:**
- なし（push と PR だけ）

- [ ] **Step 1: main の最新に載せ直す**

Run: `git fetch origin main && git rebase origin/main`
Expected: 衝突なし

Run: `cd dystopia/frontend && pnpm exec vitest run && pnpm exec tsc --noEmit --incremental false`
Expected: すべての test file が PASS、tsc は終了コード 0

- [ ] **Step 2: push する**

Run: `git push -u origin HEAD`
Expected: `feat/dystopia-legal-restructure` が origin に作られ、追跡が設定される

- [ ] **Step 3: Draft PR を作る**

本文は `.github/pull_request_template.md` の見出しに従い、1 文 1 行、箇条書きは 1 項目 1 文で、補足は下の階層に書く。
- 先頭: `Closes #1716, closes #1718, closes #1719, closes #1721, closes #1722, closes #1723, closes #1725`
- Summary: 規約とポリシーを、権利・義務と法令が求める事項の粒度に書き直したこと。
- Why: 機能の挙動まで書いていたため、機能を変えるたびに改定が要り、約束のずれ（#1716〜#1725）が出ていたこと。
  - 参考にしたサービス（X、CityHeaven、01、ヒメチャンネル）も、機能の挙動を書いていないこと。
- Before / After: 利用者から見て変わる点（運営者の氏名・住所は求めに応じて回答、カルテ・クチコミ・足跡の共有への同意、DM の確認への同意、事業の承継、照会の回答期限と個別のお知らせを外す、サーバーと事業者の所在国）。
- Decisions: 設計書の決定事項と、クラウドの事業者の所在国（請求書の発行元が Amazon Web Services, Inc. だったこと）。
  - 専門家の確認を後回しにしたことと、確認の候補（設計書の「Candidates for the expert review」）。
- Impact: 利用規約・プライバシーポリシー・ドキュメントの 3 つにチェックする。
- Verification: Task 2〜5 のコマンドと結果。
- Relations: 設計書と計画、#1715、実装の作業として残る #1717・#1720・#1724・#1726。
- 末尾: `🤖 Generated with [Claude Code](https://claude.com/claude-code)` と、空行を挟んで `https://claude.ai/code/session_019H47CVsxzYWCvDivkhY6Ki`。

Run: `gh pr create --draft --base main --title "feat(dystopia): restructure the terms and the privacy policy" --body-file <本文のファイル>`
Expected: Draft PR の URL が出る

- [ ] **Step 4: CI を確かめる**

Run: `gh pr view --json statusCheckRollup --jq '[.statusCheckRollup[] | select(.conclusion == "FAILURE") | (.name // .context)]'`
Expected: すべてのチェックが終わった後で `[]`

Docs Sync Check が失敗した場合は、PR のコメントの指摘を読み、食い違いがあれば直して push する。
判定が誤っていると考える場合は、`docs-check-approved` ラベルを付けずに、理由をユーザーに報告する。
