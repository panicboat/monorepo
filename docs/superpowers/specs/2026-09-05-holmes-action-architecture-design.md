# Holmes: Process Split, Extensible Action Envelope, Investigating UX

## Background

`system-components/holmes`（Slack `@holmes` mention と Alertmanager `critical`
alert を HolmesGPT の `/api/chat` に中継し、結果を Slack に投稿する Go
service）は現状問題なく稼働しているが、今後 GitHub 関連の action（issue
更新、comment 追加、PR 作成など）を `create_issue` に続けて追加していく
前提で、実装/設計を先に整備しておきたい。関連する既存 spec:
`docs/superpowers/specs/2026-08-15-holmes-relay-move-and-rename-design.md`
（ディレクトリ移動・リネーム）、
`docs/superpowers/specs/2026-08-15-holmes-relay-packages-design.md`
（内部パッケージ構成）。

現状の構成:

- `main.go` が1プロセスで `/slack/events`（`internal/handlers/slack`）と
  `/alertmanager/webhook`（`internal/handlers/alertmanager`）の両方を
  ホストする。
- `internal/clients/holmes.Client` は `Chat`（Slack 用、issue 作成意図の
  JSON envelope 解析つき）と `Investigate`（Alertmanager 用、envelope
  解析なし）を分けて提供している。この分離自体は既に意図通り
  （`client.go` のコメント参照）。
- Slack 側の action 解析は `create_issue` 1種類のみをフラットな
  struct（`issueAction`）で受けている。
- `internal/clients/holmes/client.go` に `issueIntentInstructions` という
  1つの const 文字列で prompt 指示を持っている。
- メンション受付時、`🔍 investigating...` という通常メッセージを
  スレッドに投稿している。

## Verified Findings

- **CI は「1 working-directory = 1 image = 1 release component」を前提と
  する**（`.github/workflows/auto-release--trigger.yaml` の
  `detect-component` が `<service>-vX.Y.Z` タグから `service` 名を1つ
  抽出し、`workflow-config.yaml` の `stack_conventions` から実在する
  root を1つ解決、`reusable--container-builder.yaml` はその
  working-directory 直下の `Dockerfile` を1つ build して
  `image-name: <service>` で push する）。`release-please-config.json` /
  `release-please-manifest.json` も `system-components/holmes` を1
  component（`holmes`, 現行 `0.6.1`）として管理している。この前提を
  崩さない形（1 image のまま）で process split するのが、CI 変更なしで
  済む唯一の経路。
- 既存の `issueAction` struct（`internal/handlers/slack/handler.go`）は
  `Action, Repo, Title, Body, Ready, Reason, Severity` を1つのフラット
  struct に持ち、`action.Action == "create_issue"` の1本分岐のみ。
  action の種類が増えると、無関係な action のフィールドが同じ struct に
  混在し始める。

## Design

### 1. Process split — 1 image, 2 Deployments, command で分岐

`cmd/slack/main.go` と `cmd/alertmanager/main.go` を新設し、現行
`main.go` の内容をそれぞれの役割ごとに分割する。`internal/config`,
`internal/clients/*` は両者で共有する（同一 Go module のまま、
go.mod 分割はしない）。

Dockerfile は2つのバイナリを同じイメージに含める:

```dockerfile
FROM golang:1.24.13-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/holmes-slack ./cmd/slack
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/holmes-alertmanager ./cmd/alertmanager

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /out/holmes-slack /holmes-slack
COPY --from=builder /out/holmes-alertmanager /holmes-alertmanager
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/holmes-slack"]
```

Kubernetes 側は Deployment を2つ（`holmes-slack`, `holmes-alertmanager`）
にし、同じイメージを参照しつつ `containers[].command` で起動バイナリを
切り替える。Service も2つに分け、Ingress は同一ホスト
（`holmes.panicboat.net`）のまま `/slack` → `holmes-slack` Service、
`/alertmanager` → `holmes-alertmanager` Service に path routing する
（Slack App の Event Subscriptions URL・Alertmanager 側の webhook URL
自体は変更しない — path prefix は現行のハンドラ登録パス
`/slack/events`, `/alertmanager/webhook` を包含する形に合わせる）。

Secret は Deployment ごとに絞る: `holmes-github`（GitHub App 秘密鍵）は
`holmes-slack` Deployment にのみ `envFrom` する。`holmes-alertmanager`
Deployment は `holmes-alertmanager` secret のみで、GitHub App の秘密鍵を
一切持たない。

CI（Dockerfile の場所、release-please component、
`workflow-config.yaml` の stack_conventions）は変更不要 —
`system-components/holmes` という1 root・1 image・1 release component の
まま、その中身が2バイナリになるだけ。

補足:

- `ConfigMap`（`HOLMES_API_URL`, `HOLMES_MODEL`）は2 Deployment 共通の
  ままでよい（どちらも Holmes API 呼び出しに使う）。
- 各 Deployment/Service のラベルは `app: holmes-slack` /
  `app: holmes-alertmanager` に分け、Service の selector もそれぞれに
  合わせる（`app: holmes` 1つを両方に付けると Service selector が
  曖昧になる）。
- `/healthz` は両バイナリが個別に実装しているので、ALB の
  `alb.ingress.kubernetes.io/healthcheck-path` annotation は Ingress
  全体ではなく Service 単位のアノテーションとして各 Service に
  `/healthz` を設定する。

### 2. Action envelope — `{action, ready, reason, payload}`

HolmesGPT に返させる JSON を次の2段構造に変える。

```json
{"action":"create_issue","ready":true,"reason":"...","payload":{"repo":"...","title":"...","body":"...","severity":"..."}}
```

Go 側もそれに合わせて envelope とタイプ別 payload に分ける:

```go
type actionEnvelope struct {
    Action  string          `json:"action"`
    Ready   bool            `json:"ready"`
    Reason  string          `json:"reason"`
    Payload json.RawMessage `json:"payload"`
}

type createIssuePayload struct {
    Repo, Title, Body, Severity string
}
```

`ready`/`reason` による確認フロー（推定 repo などを人間に確認させる
ロジック）は envelope 側の共通処理として1箇所に残り、action 固有の
フィールドは各 payload struct に閉じる。既存の `create_issue` もこの
形に載せ替える。

### 3. 実行ディスパッチ — switch 文

```go
func (h *Handler) dispatchAction(channel, threadTs string, env actionEnvelope) {
    if !env.Ready {
        h.Client.PostMessage(channel, threadTs, fmt.Sprintf("確認してください（理由: %s）", env.Reason))
        return
    }
    switch env.Action {
    case "create_issue":
        h.handleCreateIssue(channel, threadTs, env.Payload)
    default:
        // 未知の action 名 — ログのみ、通常回答として扱わない
    }
}
```

interface + registry(map) 化は検討したが、`create_issue` の1実装しか
ない現時点では YAGNI（AGENTS.md の抽象化ルール）に反すると判断し
見送る。action が増えて switch が肥大化したタイミングで、機械的に
map への置き換えに移行する。

### 4. Prompt 管理 — `go:embed` によるファイル分割

`internal/clients/holmes/client.go` に直書きされている
`slackFormattingInstructions` / `issueIntentInstructions` を
`internal/clients/holmes/prompts/*.md` に切り出し、`go:embed` で
読み込む。

```
internal/clients/holmes/prompts/
  formatting.md
  create_issue.md
```

```go
//go:embed prompts/formatting.md
var formattingPrompt string

//go:embed prompts/create_issue.md
var createIssuePrompt string
```

action を追加する際は既存ファイルを触らず新規 `.md` を1つ足すだけで
済み、prompt 文言の diff が Go の文字列リテラルでなく Markdown として
レビューできる。

### 5. 判定精度・安定性 — action 名の有無で早期分岐

現状は JSON パース失敗と action 名不一致を区別せず、同じフォールバック
（通常テキストとして投稿）に流している。これだと「action 実行を意図
したが payload が壊れていた」ケースがユーザーに伝わらずサイレントに
失敗する。

改善: `action` フィールドの有無で早期に分岐する。

- `action` が空 → 通常の回答テキストとして投稿（従来通り）
- `action` が既知の値だが `payload` の decode に失敗 →
  「アクションの解析に失敗しました」と Slack に投稿（従来は raw な
  JSON 文字列がそのままテキスト表示されていた）
- `action` が未知の値 → 同様にエラーとして扱う

### 6. Investigating UX — メッセージ投稿からリアクションへ

`🔍 investigating...` というスレッド投稿を廃止し、メンション元の投稿
（`evt.Ts`）へのリアクション付与に置き換える。

- 受付時: `:eyes:` を追加
- 調査成功時: `:white_check_mark:` を追加（`:eyes:` は残したまま）
- 調査失敗時: `:face_vomiting:` を追加（`:eyes:` は残したまま）

`internal/clients/slack.Client` に `AddReaction(channel, ts, name
string) error`（Slack `reactions.add` API）を追加し、
`messagePoster` interface にも追加する。分析結果・エラーメッセージの
スレッド投稿自体は現状通り変更しない。

## Changes

- `system-components/holmes/cmd/slack/main.go`（新規、旧 `main.go` の
  Slack 部分）
- `system-components/holmes/cmd/alertmanager/main.go`（新規、旧
  `main.go` の Alertmanager 部分）
- `system-components/holmes/main.go`（削除）
- `system-components/holmes/Dockerfile`（2バイナリ build に変更）
- `system-components/holmes/kubernetes/base/`:
  `deployment.yaml` → `deployment-slack.yaml` /
  `deployment-alertmanager.yaml`、`service.yaml` も2分割、
  `ingress.yaml` を path routing に変更、`kustomization.yaml` 更新
- `system-components/holmes/kubernetes/overlays/production/`:
  `deployment.yaml`（image tag 更新用）・`external-secret.yaml` の
  対応を2 Deployment 分に更新
- `internal/handlers/slack/handler.go`: `issueAction` →
  `actionEnvelope` + `createIssuePayload`、switch ディスパッチ、
  action 名早期分岐、`AddReaction` 呼び出しへの置き換え
- `internal/clients/holmes/client.go`: prompt 文言を
  `internal/clients/holmes/prompts/*.md` に切り出し、envelope 形式の
  JSON 指示に更新
- `internal/clients/slack/api.go`: `AddReaction` 追加
- 対応する `*_test.go` 一式

## Testing

- `go build ./... && go test ./... -v -race -count=1`
  （`cmd/slack`, `cmd/alertmanager` 双方の build 確認を含む）
- `kustomize build kubernetes/overlays/production` で
  Deployment/Service/Ingress が2系統とも妥当な manifest になることを
  確認
- Docker イメージのローカル build（`docker build .`）で2バイナリが
  distroless image に含まれることを確認
- 既存の `handler_test.go` を `actionEnvelope` 形式に合わせて更新し、
  `create_issue` の ready/not-ready 両方のフローを引き続きカバーする

## Out of Scope

- `create_issue` 以外の実 action（issue 更新、comment 追加、PR 作成）の
  実装そのもの — 今回は envelope/dispatch/prompt の土台のみ整備し、
  個別 action は別タスクで着手する。
- action dispatch の interface + registry(map) 化 — action 数が増えて
  switch 文が肥大化した時点で着手する。
- Alertmanager 経由での action 実行 — `Investigate` に
  issueIntentInstructions を付けない現行方針を維持する（一方向の
  通知に人間の確認を挟めないため）。
- `holmes.panicboat.net` 以外のホスト名・別ドメインの検討は行わない。
