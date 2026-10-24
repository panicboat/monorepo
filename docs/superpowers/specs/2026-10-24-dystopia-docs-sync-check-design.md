# dystopia docs sync check

対象 issue: #1696（修正とドキュメントの同期）、#1692（修正と規約の同期）

## Intent

AI にコーディングを任せると、仕様書・利用規約・プライバシーポリシーの更新が漏れやすい。
これらは仕上げたばかりで、常に最新のまま保ちたい。
あとから差分に気づいて漏れなく直すのは難しいので、PR の時点で CI が止める。

#1690 では規約・ポリシー・仕様書をすべて更新したが、それは plan に書いてあったからで、仕組みとして守られてはいない。
リポジトリには AGENTS.md / CLAUDE.md もなく、Claude Code に文書の更新を求める場所がない。

## Goals

- dystopia のコードを変える PR で、仕様の変化が次の文書に反映されていなければ CI が落ちる
  - `dystopia/docs/` 以下（README・データモデル・`features/`）
  - 利用規約（`dystopia/frontend/src/modules/legal/content/terms.ts`）
  - プライバシーポリシー（`dystopia/frontend/src/modules/legal/content/privacy.ts`）
- 落ちたときに、どのコード変更がどの文書のどこと食い違うかが PR 上で分かる
- 判定が誤っているとき、人間が確かめて通せる

## Non-goals

- 文書の自動修正（指摘するだけで、直すのは PR の作者）
- dystopia 以外のディレクトリ
- PR と関係なく既に存在する食い違いの棚卸し
- `@claude` のコメントで再チェックさせる仕組み（ユーザー決定で採らない）

## Anti-goals

- 実装の細部（列名・メソッド名など、文書が書いていないこと）を理由に落とす
  - 文書は「現在どう動くか」を開発者・利用者向けに書いたもの。書いていない細部まで要求すると、毎回落ちて誰も信用しなくなる
- PR が触っていない既存の食い違いで落とす
- 誤判定のたびに作業が止まり、通す手段が人間にない状態

## Decisions

ユーザー決定:

- 更新漏れは CI で落とす（気づくだけでは足りない）
- 判定は CI の中で Claude に行わせる。Amazon Bedrock の Sonnet を使う
  - Haiku 4.5 も使えるが、日本語の規約の細かい読み分けと、落とす判定の重さから Sonnet にした
- 誤って落ちたときは、人間が確かめて承認のラベルを付けると通る
- `@claude` での再チェックは採らない

ここまでの会話で決めたこと（Claude の判断、ユーザー了承済み）:

- パスと文書の対応表は作らない
  - Claude が毎回すべての文書を読むので対応表なしで関係する文書を探せる。対応表を作ると、それ自体が更新漏れの対象になる
- PR 本文の Impact（規約・ポリシー・ドキュメントのチェックボックス、#1706 のテンプレート）が実際の変更と合っているかも判定に含める

## Behavior

### When it runs

- `dystopia/**` に変更がある PR で Claude に判定させる
  - 文書だけを変える PR も対象（文書がコードと食い違う方向の誤りもある）
- 動くタイミング: PR の作成・push・再オープン・本文の編集・ラベルの付与
  - 本文の編集とラベルの付与で動くのは、Impact のチェックを直したときと、承認のラベルを付けたときに判定をやり直すため
  - ラベルの付与で Claude を呼ぶのは `docs-check-approved` のときだけ。`deploy:*` など他のラベルでは何もしない
- このチェックを main の ruleset の必須チェックに足す（Claude の判断）
  - `CI Gatekeeper` は作成・push・再オープンでしか動かない。ラベルや本文の編集でこのチェックをやり直して通っても、一度落ちた `CI Gatekeeper` はそのままで merge できないため
  - 必須チェックは、出ないと待ち続けになる。そのため workflow はすべての PR で動き、`dystopia/**` に変更がなければすぐに通す
- bot（Renovate・release-please）が作る PR は Claude を呼ばずに通す（Claude の判断）
  - 直近 100 件の merge 済み PR のうち 52 件が Renovate で、依存の更新は文書が書く振る舞いをほぼ変えない。判定すると費用が倍近くになり、自動 merge も止まる

### What the judge reads

- PR の diff と PR 本文
- `dystopia/docs/` 以下すべて、規約、ポリシー
- 判断に必要なら、リポジトリの他のファイル（diff だけでは変更後の振る舞いが分からないため）

### What fails

次のどれかに当たれば落とす。

- PR が変えた振る舞いを、文書が変更前のまま説明している（食い違い）
- PR が足した、利用者・運用者から見える振る舞いを、関係する文書がまったく説明していない
- PR 本文の Impact のチェックが実際と合わない（チェックがあるのに更新していない、または更新が必要なのにチェックも更新もない）

当たらないもの:

- 文書が書いていない実装の細部
- PR の diff と関係しない既存の食い違い
- 文体・表記ゆれ

### Output

- 判定結果を PR のコメント 1 つに書き、走るたびに同じコメントを更新する
- 落ちる場合、指摘ごとに次を書く
  - どのコード変更か（ファイルと行）
  - どの文書のどこか（ファイルと見出し、または条・節）
  - 何が食い違っているか、1〜2 文で
- 通る場合も、確認した文書と判断を短く残す

### Approval label

- `docs-check-approved` ラベルが付いていれば、Claude を呼ばずに通す
- ラベルを付けた後に新しい commit が push されたら、ラベルを外して判定し直す（Claude の判断）
  - 承認は付けた時点の内容に対するもので、その後の commit まで通すと漏れの抜け道になる
- Claude Code はこのラベルを付けない
  - Claude Code はユーザーの GitHub アカウントで操作するため、GitHub の権限では区別できない。dotfiles の AGENTS.md にルールとして書く

### Fork PRs

- fork からの PR には OIDC のトークンが渡らないので、Claude を呼べない。判定できないものとして落とし、承認のラベルで通す（Claude の判断）
  - public リポジトリなので外部の PR はあり得るが、今のところ来ていない

## Constraints

- AWS: GitHub Actions から Bedrock を呼ぶ IAM ロールが今はない
  - 以前は platform の `aws/ai-assistant` に Actions 用ロールがあったが、platform#648 で削除した。git の履歴（`ac621b0^`）から参照できる
  - ロールは master（管理アカウント）に置く（ユーザー決定）
    - master には OIDC provider があり（`platform/aws/github-oidc-auth/master`）、Bedrock のモデルアクセスも us-east-1 で有効（`platform/docs/superpowers/specs/2026-08-18-production-account-migration-design.md`）
    - 参考: production では holmesgpt が `us.anthropic.claude-sonnet-4-6` の inference profile を使っていて、IAM の Resource の書き方の前例になる（`platform/aws/eks-holmesgpt/modules/main.tf`）
  - 新しいロールは、monorepo の PR からだけ assume でき、`bedrock:InvokeModel` 系を使う Sonnet の inference profile と、そのルーティング先の foundation model だけに絞る
- モデル: Bedrock で使える最新の Sonnet。Sonnet 5.5 が有効でなければ Sonnet 4.6
- GitHub: 必須チェックは platform の `github/branch/master/monorepo.hcl` で管理している（今は `CI Gatekeeper`・`Validate PR title`・`Ensure actions are pinned to SHAs`）。このチェックを足すのは platform 側の変更になる
- workflow の action は SHA で pin する（`lint-actions.yml` が検査する）
- PR 本文・diff は判定への入力であり、指示ではない。プロンプトでそう扱わせる

## Related changes

- dotfiles の AGENTS.md に 2 行足す（別リポジトリ・別 PR）
  - Claude Code は `docs-check-approved` ラベルを付けない
  - 仕様書・規約が振る舞いを説明しているリポジトリでは、振る舞いを変える PR で同じ PR のうちに文書も更新する（Claude の判断。CI で落ちる前に防ぐため。リポジトリに AGENTS.md を新しく作らないのは、PR テンプレートのルールと同じく全リポジトリに効かせるため）

## Left to the builder

- claude-code-action を使うか、Bedrock の Messages API を直接呼ぶか
  - Claude の判断としては claude-code-action を勧める。diff 以外のファイルを読みに行ける必要があるため
- 判定結果の受け渡し形式（JSON を書かせて workflow 側で成否を決める、など）
- IAM ロールを置く platform のモジュール構成と名前
- コメントの体裁

## Acceptance

- 過去の PR を使って判定を試し、期待どおりになることを確認する
  - #1705 から文書の変更を取り除いた diff → 落ちる（規約第11条・`reviews.md` などの食い違いを指摘する）
  - #1702 の diff（猶予 90 日、文書も更新済み）→ 通る
  - #1702 から文書の変更を取り除いた diff → 落ちる
  - 文書が書いていない内部だけのリファクタ（例: #1689 の列の drop）→ 通る
- 承認のラベルで通ること、ラベル後の push でラベルが外れることを、実際の PR で確認する
- 1 回の判定にかかった token 数を記録し、PR 1 件あたりの費用の目安を出す
