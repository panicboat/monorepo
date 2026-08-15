# holmes Package Layout Refactor

## Background

`system-components/holmes/workspace/`（旧 `services/holmes-relay/workspace/` — 別 PR で `system-components/holmes` へ移動・`holmes-relay` から `holmes` へリネーム済み）は `package main` の1パッケージに全ファイルがフラットに置かれている（`config.go`, `holmes.go`, `slack_verify.go`, `slack_api.go`, `slack_handler.go`, `alertmanager_handler.go` とそれぞれのテスト）。今後 integration（例: PagerDuty）を追加する際に同じ調子でファイルが積み上がり、パッケージ境界も無いため拡張性が低い。

## Goal

ディレクトリ構成を導入し、外部連携ごとの追加が「ディレクトリを1つ足すだけ」で済む形にする。

## Approaches Considered

- **A. 連携先ドメインごとに1パッケージ**（例: `internal/slack/` に API client と handler を同居）— フラット構成からの変更は小さいが、Slack 側に将来別機能（スラッシュコマンド等）を足すと同じパッケージが肥大化する。
- **B. client 層 / handler 層で分ける**（`internal/clients/<name>/` と `internal/handlers/<name>/`）— Holmes client は現時点で既に Slack handler と Alertmanager handler の両方から使われており、「1つの client を複数 handler が共有する」構造が実在する。この分け方が最も実態に忠実。**採用**。
- **C. internal を1つにまとめるだけの最小変更** — ディレクトリは増えるが package 境界が無いままで、指摘された拡張性の問題を実質的に解消しない。不採用。

Clean Architecture（entities/usecases/adapters/frameworks の4層）も検討したが、このサービスは「イベントを受けて Holmes を呼び、Slack に投稿する」薄い中継で、独立して切り出す価値のある複雑なドメインロジックを持たない。4層構造を導入すると抽象化が実装より重くなるため見送る。ただし、Clean Architecture の核心である「利用する側が interface を定義し、具体型ではなく抽象に依存する」という考え方は安価に取り入れられ、実利（テストが実 HTTP サーバー不要になる、将来の差し替えが容易になる）があるため、B の構成に上乗せする。

## Design

### Directory Layout

```
system-components/holmes/workspace/
├── main.go                          (配線のみの薄い entrypoint)
├── internal/
│   ├── config/
│   │   ├── config.go                (旧 config.go の Config/loadConfig)
│   │   └── config_test.go
│   ├── clients/
│   │   ├── holmes/
│   │   │   ├── client.go            (旧 holmes.go)
│   │   │   └── client_test.go
│   │   └── slack/
│   │       ├── api.go               (旧 slack_api.go)
│   │       ├── api_test.go
│   │       ├── verify.go            (旧 slack_verify.go: 署名検証・mention parsing・thread history 整形)
│   │       └── verify_test.go
│   └── handlers/
│       ├── slack/
│       │   ├── handler.go           (旧 slack_handler.go)
│       │   └── handler_test.go
│       └── alertmanager/
│           ├── handler.go           (旧 alertmanager_handler.go)
│           └── handler_test.go
```

パッケージ名: `config`, `holmes`（clients/holmes 配下）, `slack`（clients/slack 配下）, `slack`（handlers/slack 配下、import alias で区別: `slackclient "…/clients/slack"` と `slackhandler "…/handlers/slack"` のように呼び出し側で alias する）, `alertmanager`（handlers/alertmanager 配下）。

### Interfaces (handler 側で定義)

`internal/handlers/slack/handler.go`:

```go
type investigator interface {
    Investigate(ask string) (string, error)
}

type messagePoster interface {
    PostMessage(channel, threadTs, text string) error
    ConversationsReplies(channel, threadTs string) ([]clients_slack.Message, error)
}
```

（`clients_slack.Message` は `internal/clients/slack` パッケージが公開する `Message` 型 — 現行の `slackMessage` 構造体をエクスポートする。）

`internal/handlers/alertmanager/handler.go`:

```go
type investigator interface {
    Investigate(ask string) (string, error)
}

type messagePoster interface {
    PostMessage(channel, threadTs, text string) error
}
```

`slackHandler`/`alertmanagerHandler` 構造体のフィールド型をこれらの interface に変更する（現行は `*HolmesClient`/`*slackAPIClient` の具体型）。`*holmes.Client` と `*slack.Client`（clients 側の型）はどちらも自然にこれらの interface を満たすため、`main.go` での配線コードは型注釈以外変更不要。

### main.go

現行の handler wiring ロジックは変えず、import パスとコンストラクタ呼び出しの参照先だけを新パッケージパスに更新する。

## Testing

各パッケージ移動後に `go build ./... && go test ./... -v -race -count=1` で確認する。移動前後でテストの内容自体は変更しない（ファイルパスとパッケージ宣言のみ変更）。ただし interface 化した2ファイル（`handlers/slack/handler_test.go`, `handlers/alertmanager/handler_test.go`）は、既存の `httptest.NewServer` ベースのテストをそのまま残してよい（interface を満たす具体型として `clients/holmes.Client`/`clients/slack.Client` を使い続けられるため、テストの書き換えは必須ではない）。軽量フェイクへの置き換えは本 refactor のスコープ外とし、必要になった時点で別途行う。

## Out of Scope

- 既存の振る舞い変更は一切行わない（純粋な構造変更）。
- テストを `httptest` ベースから interface のインメモリフェイクに書き換えることは行わない（interface 化はしても、テストの実装方式は変更しない）。
- 新しい integration（PagerDuty 等）の追加は行わない。
