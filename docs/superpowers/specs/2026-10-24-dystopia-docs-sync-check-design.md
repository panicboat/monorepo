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
- 動くタイミング: PR の作成・push・再オープン・本文の編集・ラベルの付与と削除
  - 本文の編集で動くのは、Impact のチェックを直したときに判定をやり直すため
    - タイトルだけの編集では何もしない（Claude の判断）。本文か base branch が変わったときだけ判定する。base が変わると diff が変わるため
  - ラベルで動くのは `docs-check-approved` のときだけ。`deploy:*` など他のラベルでは何もしない
    - 承認のラベルを人間が外したら、判定し直す（Claude の判断）。付け間違えたラベルを外した人は、落ちることを期待するため
- このチェックを main の ruleset の必須チェックに足す（Claude の判断）
  - `CI Gatekeeper` は作成・push・再オープンでしか動かない。ラベルや本文の編集でこのチェックをやり直して通っても、一度落ちた `CI Gatekeeper` はそのままで merge できないため
  - 必須チェックは、出ないと待ち続けになる。そのため workflow はすべての PR で動き、`dystopia/**` に変更がなければすぐに通す
  - 結果は job の成否ではなく、commit status `Docs Sync Check` として書く（Claude の判断）
    - `deploy:*` のラベルでも workflow は起動する。job の成否を必須チェックにすると、何もしない run が同じ commit に新しい結果を残し、落ちていた判定を上書きしうる
    - commit status なら、何もしない run は status に触れないので、最後に判定した run の結果が残る
  - `CI Gatekeeper` が待つ workflow からこの workflow を外す
    - 判定の job が Bedrock の障害で落ちたとき、承認のラベルで通しても `CI Gatekeeper` が落ちたまま残るため
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

- `docs-check-approved` ラベルを付けたとき、Claude を呼ばずに通す
- ラベルが付いたままの PR に新しい commit が push されたら、ラベルを外して判定し直す（Claude の判断）
  - PR の作成時からラベルが付いている場合も同じく外して判定する。まだ誰も確かめていない内容だから
- ラベルが付いたままの PR で本文の編集や再オープンがあっても、status には触れない（Claude の判断）
  - push の直後に本文を編集すると、push の run が取り消されてラベルが外れないまま残ることがある。そのとき編集の run がラベルを見て通すと、新しい commit が判定されないまま通ってしまう
  - status に触れなければ、commit が変わっていないときはラベルを付けたときの `success` が残り、変わっていたときは status がないので merge が止まる
  - 承認は付けた時点の内容に対するもので、その後の commit まで通すと漏れの抜け道になる
- Claude Code はこのラベルを付けない
  - Claude Code はユーザーの GitHub アカウントで操作するため、GitHub の権限では区別できない。dotfiles の AGENTS.md にルールとして書く

### Fork PRs

- fork からの PR では workflow は何もしない（Claude の判断）
  - fork の PR には OIDC のトークンも、status を書ける権限も渡らない。承認のラベルを付けても status を書けないので、ラベルでは通せない
  - status `Docs Sync Check` が出ないので merge できない。通すときは、人間が内容を確かめて `gh api` で status を `success` にする
  - public リポジトリなので外部の PR はあり得るが、今のところ来ていない

## Constraints

- AWS: master（管理アカウント）の既存の Bedrock ロールを使う（ユーザー決定で master、ロールの再利用は Claude の判断）
  - platform#1101 が `aws/github-oidc-auth/modules/bedrock.tf` に `github-oidc-auth-master-github-actions-bedrock-role` を作った
    - 権限は `bedrock:InvokeModel`・`bedrock:InvokeModelWithResponseStream` を、`bedrock_models` の global inference profile とそのルーティング先の foundation model に絞ってある
    - 信頼条件は `repo:panicboat/platform:environment:renovate-major-review` だけで、モジュールに直書きしてある
  - platform 側では、信頼する sub を変数にして env.hcl から渡し、master に `repo:panicboat/monorepo:environment:docs-sync-check` を足す
    - ロールを分けない理由: 権限がどちらも「Sonnet 4.6 を呼ぶだけ」で同じで、分けても持ち出されたときの被害は変わらない
    - 分けると、ARN の組み立て・テスト・出力がまるごと 2 つになる
  - judge の job は GitHub environment `docs-sync-check` で動かす
    - plan ロール（master・develop・production の `ReadOnlyAccess`）は `repo:panicboat/monorepo:pull_request` を信頼している。judge の job が同じ sub の OIDC token を出せると、prompt injection で持ち出されたときに全アカウントの読み取りまで被害が広がるため、environment で sub を分ける（platform#1101 と同じ理由）
    - environment の名前に `master` は使えない。apply ロールが `repo:panicboat/monorepo:environment:master` を信頼しているため
    - monorepo には environment がまだない。`renovate-major-review` も IaC ではなく手で作られているので、同じく手で作る（保護ルールなし）
- モデル: `global.anthropic.claude-sonnet-4-6`
  - master では Sonnet 5 / Opus 5 の Bedrock quota が 0 で、自分では引き上げられない（platform#1101 の設計書）
  - claude-code-action が裏で Haiku を使う処理も、`ANTHROPIC_DEFAULT_HAIKU_MODEL` で Sonnet 4.6 に向ける。ロールが Sonnet 4.6 しか許さないため
- workflow の形は platform の `renovate-major-review.yaml` に合わせる
  - Claude を動かす job には読み取りだけの `github.token` を渡し、結果は `--json-schema` の構造化出力で受け取る
  - コメントの投稿は、`pull-requests: write` だけを持つ別の job が行う
- GitHub: 必須チェックは platform の `github/branch/master/monorepo.hcl` で管理している（今は `CI Gatekeeper`・`Validate PR title`・`Ensure actions are pinned to SHAs`）。このチェックを足すのは platform 側の変更になる
- workflow の action は SHA で pin する（`lint-actions.yml` が検査する）
- PR 本文・diff は判定への入力であり、指示ではない。プロンプトでそう扱わせる

## Related changes

- dotfiles の AGENTS.md に 2 行足す（別リポジトリ・別 PR）
  - Claude Code は `docs-check-approved` ラベルを付けず、status `Docs Sync Check` も書かない
  - 仕様書・規約が振る舞いを説明しているリポジトリでは、振る舞いを変える PR で同じ PR のうちに文書も更新する（Claude の判断。CI で落ちる前に防ぐため。リポジトリに AGENTS.md を新しく作らないのは、PR テンプレートのルールと同じく全リポジトリに効かせるため）

## Left to the builder

- 判定結果の JSON の項目（成否と、コメント本文を含める）
- 信頼する sub の変数名
- コメントの体裁
- environment を使うと PR に deployment の記録が走るたびに付く。気になる場合に消せるかは、実装時に GitHub の仕様を確かめる

## Acceptance

- 過去の PR を使って判定を試し、期待どおりになることを確認する
  - #1705 から文書の変更を取り除いた diff → 落ちる（規約第11条・`reviews.md` などの食い違いを指摘する）
  - #1702 の diff（猶予 90 日、文書も更新済み）→ 通る
  - #1702 から文書の変更を取り除いた diff → 落ちる
  - #1689 の diff（`data-model.md` が書いていた `push_enabled` 列の drop、文書は未更新）→ 落ちる
  - 文書が書いている振る舞いに実装を合わせる修正（例: #1683 の Cognito のユーザー削除）→ 通る
- 承認のラベルで通ること、ラベル後の push でラベルが外れることを、実際の PR で確認する
- 1 回の判定にかかった token 数を記録し、PR 1 件あたりの費用の目安を出す
