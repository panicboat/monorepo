# Rename holmes to pennyworth

## Background

`system-components/holmes`（Slack `@holmes` mention / Alertmanager `critical`
alert を HolmesGPT の調査に中継し、GitHub issue 作成まで担う service）は、
process split（`cmd/slack`/`cmd/alertmanager`）と action envelope による
拡張性の整備が完了し、今後 GitHub 操作（issue 更新、PR 作成等）を広げて
いく前提が整った。この段階で `holmes` という名前を見直す。

`holmes` は HolmesGPT（調査を担う AI エンジン）中継専用の名前に見え、
GitHub 操作まで担う今後の役割とズレる。加えて HolmesGPT 本体（別リポジトリ
`panicboat/platform` の Helm chart、namespace `holmesgpt`）と同じ語を
含む重複は、リネーム移動時の spec（`2026-08-15-holmes-relay-move-and-rename-design.md`）
で「意図的に許容する」としていたが、これも解消する。

新しい名前は **pennyworth**（Alfred Pennyworth、バットマンの執事）。
「HolmesGPT＝名探偵、pennyworth＝取次ぎと実務（Slack 投稿・GitHub 操作）を
担う執事」という役割分担のメタファーで、探偵から執事へ軸を移す。

- Slack App の表示名は `Alfred Pennyworth`（人間向け UI 上の呼称）
- サービス自体の識別子（ディレクトリ・image・K8s リソース・ドメイン等）は
  `pennyworth`（既存の `holmes`, `frontend`, `monolith` と同じ単語 1 つの
  命名慣習を維持。表示名と技術識別子は別レイヤーとして意図的に分離する）
- HolmesGPT API を呼ぶクライアントパッケージ（現 `internal/clients/holmes`）
  は、サービス名が pennyworth になったことで `holmes` という語がサービス名
  ともクライアント名とも取れる旧来の曖昧さがむしろ悪化するため、
  `internal/clients/holmesgpt` に改名し、HolmesGPT を指す識別子だと明示
  する。`config.go` の `HolmesAPIURL`/`HolmesModel`、環境変数
  `HOLMES_API_URL`/`HOLMES_MODEL`、`holmesClient` 等の関連識別子もこれに
  合わせて `HolmesGPT` 系に統一する。

## Verified Findings

- **AWS Secrets Manager 上に holmes/pennyworth 関連の secret は 1 つも存在
  しない**（`aws secretsmanager list-secrets` で `holmes`/`eks`/
  `panicboat`/`github-app` を含む名前を検索して確認）。Terraform も
  まだ apply されていない。実運用中のリソースはなく、このリネームで
  データ移行やダウンタイムの心配はない。
- **`kubernetes/overlays/production/external-secret.yaml` の
  `remoteRef.key` と Terraform が作る secret 名が食い違っている**
  （前者は `eks/holmesgpt/slack` 等、後者
  `infrastructure/aws/modules/main.tf` は `panicboat/holmes/slack` 等）。
  調査の結果、これは単純なバグではなく2つの別事情が絡んでいた:
  - **Alertmanager 用 (`eks/holmesgpt/alertmanager`)**: `panicboat/platform`
    リポジトリの
    `kubernetes/components/prometheus-operator/production/kustomization/holmes-alertmanager-external-secret.yaml`
    がコメントで明記する通り、「1つの AWS Secrets Manager 値を、
    platform 側（Alertmanager 本体の Slack 通知）と monorepo 側
    （このリレー service 自身のトークン検証）の両方が別々に sync する」
    意図的な共有設計。**platform repo 側は変更しないため、このキー自体は
    変更できない** — Alertmanager 用の secret は `holmesgpt` を冠したまま
    残る。
  - **Slack 用 (`eks/holmesgpt/slack`)**: platform repo 側からの参照は
    見当たらず、monorepo 側だけが使うキーだった。`panicboat/holmes/slack`
    という Terraform リソースは実際にはどの ExternalSecret からも参照
    されておらず孤立していた（README.md の Manual Setup 手順もこの
    孤立した path を指しており、実効性がなかった）。
- **`eks/{component}/{role}` は `panicboat/platform` 側の複数コンポーネント
  （`oauth2-proxy`, `keycloak`, `grafana`, `alertmanager`）で使われている
  secret path の事実上の標準パターン**だが、`panicboat/{component}/{role}`
  は holmes だけの独自パターンだった。一方 monorepo 側には
  `dystopia/monolith/database` という `{product}/{component}/{role}` 
  パターンの実例がある。今回は `system-components` を product 相当の
  segment として使い、`system-components/pennyworth/{role}` に統一する
  （platform repo 側のパターンには手を入れない）。
- **GitHub App の実名は `panicboat-holmesgpt-bot`**（`holmes-bot` ではない）。
  `github-app/holmes-bot` という既存の secret path 表記は実名と食い違って
  いた。App 自体（GitHub.com 上の登録）はリネームしない。

## Naming Map

| カテゴリ | 現在 | 変更後 |
|---|---|---|
| ディレクトリ | `system-components/holmes/` | `system-components/pennyworth/` |
| Go module path | `github.com/panicboat/monorepo/system-components/holmes` | `github.com/panicboat/monorepo/system-components/pennyworth` |
| Docker image | `ghcr.io/panicboat/monorepo/holmes` | `ghcr.io/panicboat/monorepo/pennyworth` |
| バイナリ名 | `/holmes-slack`, `/holmes-alertmanager` | `/pennyworth-slack`, `/pennyworth-alertmanager` |
| K8s Deployment/Service 名・label | `holmes-slack`, `holmes-alertmanager` | `pennyworth-slack`, `pennyworth-alertmanager` |
| K8s Secret 名 | `holmes-slack`, `holmes-alertmanager`, `holmes-github` | `pennyworth-slack`, `pennyworth-alertmanager`, `pennyworth-github` |
| Ingress hostname | `holmes.panicboat.net` | `pennyworth.panicboat.net` |
| Flux ImagePolicy/ImageRepository/ImageUpdateAutomation/Kustomization 名 | `holmes` | `pennyworth` |
| Terragrunt state key | `system-components/holmes/production/terraform.tfstate` | `system-components/pennyworth/production/terraform.tfstate` |
| release-please component | `holmes` | `pennyworth` |
| Slack App 表示名 | (未設定 / 旧 holmes 名義) | `Alfred Pennyworth` |
| GitHub App（実体） | `panicboat-holmesgpt-bot` | 変更しない |
| `internal/clients/holmes` パッケージ | `internal/clients/holmes` | `internal/clients/holmesgpt` |
| `config.Config` フィールド | `HolmesAPIURL`, `HolmesModel` | `HolmesGPTAPIURL`, `HolmesGPTModel` |
| 環境変数 | `HOLMES_API_URL`, `HOLMES_MODEL` | `HOLMESGPT_API_URL`, `HOLMESGPT_MODEL` |
| Go 変数名 | `holmesClient`, `Handler.Holmes` | `holmesGPTClient`, `Handler.HolmesGPT`（フィールド名も HolmesGPT を指すことを明示） |
| Secret: Slack 用 | `panicboat/holmes/slack`（Terraform, 孤立） | `system-components/pennyworth/slack`（Terraform, 実際に ExternalSecret から参照） |
| Secret: Alertmanager 用 | `panicboat/holmes/alertmanager`（Terraform, 孤立） / 参照先は `eks/holmesgpt/alertmanager` | Terraform リソースは削除。`eks/holmesgpt/alertmanager` をそのまま直接参照（platform 側と共有、変更なし） |
| Secret: GitHub App 用 | `github-app/holmes-bot` | `github-app/holmesgpt-bot`（実名 `panicboat-holmesgpt-bot` に近づける。App 自体は変更しない） |

## Changes

### 1. ディレクトリ移動・リネーム

`git mv system-components/holmes system-components/pennyworth` の後、
以下を Naming Map に従って更新する。

- `go.mod`（module path）
- `internal/**/*.go` の import path（`system-components/holmes` →
  `system-components/pennyworth`）
- `cmd/slack/main.go`, `cmd/alertmanager/main.go`: import path、
  ログ文字列（`"holmes-slack listening on %s"` 等）
- `Dockerfile`: バイナリ出力名 (`/out/holmes-slack` →
  `/out/pennyworth-slack` 等)、`COPY`/`ENTRYPOINT` の対象パス
- `.gitignore`: バイナリ名エントリ

### 2. `internal/clients/holmes` → `internal/clients/holmesgpt`

- `client.go`, `client_test.go`, `prompts/*.md` をディレクトリごと移動
- パッケージ宣言、import path、テスト内のコメントを更新
- `internal/config/config.go`: `HolmesAPIURL`→`HolmesGPTAPIURL`,
  `HolmesModel`→`HolmesGPTModel`、対応する `os.Getenv` キーを
  `HOLMESGPT_API_URL`/`HOLMESGPT_MODEL` に変更（`LoadSlack`/
  `LoadAlertmanager` のエラーメッセージ文字列も追従）
- `cmd/slack/main.go`, `cmd/alertmanager/main.go`: `holmesClient` →
  `holmesGPTClient`、`holmes.New(...)` → `holmesgpt.New(...)`
- `internal/handlers/slack/handler.go`,
  `internal/handlers/alertmanager/handler.go`: `Handler.Holmes` フィールド
  → `Handler.HolmesGPT`（`investigator` interface 自体は変更不要）

### 3. Kubernetes manifests（base + overlays/production）

- `kubernetes/base/`: `deployment-{slack,alertmanager}.yaml`,
  `service-{slack,alertmanager}.yaml`, `ingress.yaml`, `configmap.yaml`,
  `kustomization.yaml` — `holmes` を全て `pennyworth` に置換
  （`metadata.name`, `app` label, `command`, `envFrom.secretRef.name`,
  `configMapRef.name`, image 名, hostname）
- `kubernetes/base/configmap.yaml`: `HOLMES_API_URL`/`HOLMES_MODEL` キーを
  `HOLMESGPT_API_URL`/`HOLMESGPT_MODEL` に変更（値の
  `http://holmesgpt-holmes.holmesgpt.svc.cluster.local` は HolmesGPT 本体
  ＝別リポジトリの Service 名なので変更しない）
- `kubernetes/overlays/production/deployment.yaml`: Deployment 名を
  `pennyworth-slack`/`pennyworth-alertmanager` に、image を
  `ghcr.io/panicboat/monorepo/pennyworth` に、`$imagepolicy` コメントを
  `flux-system:pennyworth` に変更
- `kubernetes/overlays/production/external-secret.yaml`: 3 つの
  ExternalSecret を Naming Map の Secret 欄どおりに書き換える
  （`holmes-slack`→`pennyworth-slack` の `remoteRef.key` を
  `system-components/pennyworth/slack` に、`holmes-alertmanager`→
  `pennyworth-alertmanager` は名前だけ変えて `remoteRef.key:
  eks/holmesgpt/alertmanager` は維持、`holmes-github`→
  `pennyworth-github` の `remoteRef.key` を `github-app/holmesgpt-bot` に）

### 4. Flux（`clusters/production/system-components/holmes/` →
   `.../pennyworth/`）

`git mv` の後、`image-automation.yaml`, `image-policy.yaml`,
`image-repository.yaml`, `kustomization.yaml`（Flux Kustomization CR）,
`service.yaml` 内の `metadata.name`, `imageRepositoryRef.name`,
`spec.image`, `spec.path`（`./system-components/pennyworth/kubernetes/...`）
を更新する。

### 5. Terraform / Terragrunt

- `infrastructure/aws/modules/main.tf`:
  `aws_secretsmanager_secret.holmes_slack` → `pennyworth_slack`、
  `name = "system-components/pennyworth/slack"` に、`description` の
  `holmes` も `pennyworth` に変更。`aws_secretsmanager_secret.holmes_alertmanager`
  は削除（`eks/holmesgpt/alertmanager` を直接参照するため、monorepo 側で
  この secret を作る必要がない）。ファイル末尾の手動投入手順コメントから
  Alertmanager 用の手順（`--secret-id panicboat/holmes/alertmanager`）を
  削除し、Slack 用の手順の `--secret-id` を
  `system-components/pennyworth/slack` に更新する
- `infrastructure/aws/modules/outputs.tf`: `alertmanager_secret_arn`
  output を削除（参照先のリソースがなくなるため）。`slack_secret_arn`
  は `pennyworth_slack` を参照するよう更新
- `infrastructure/aws/modules/variables.tf`: 上記に伴う variable の
  名前・参照を更新（`holmes` を含むもの）
- `infrastructure/aws/production/env.hcl`: `Purpose = "holmes"` →
  `"pennyworth"`
- `infrastructure/aws/production/terragrunt.hcl`: state key
  `system-components/holmes/...` → `system-components/pennyworth/...`
  （新規 backend として初期化される — 旧 state は未 apply なので実害なし）

### 6. release-please

- `.github/release-please-config.json`: packages キーを
  `system-components/pennyworth` に、`component: "pennyworth"` に変更
- `.github/release-please-manifest.json`: キーを
  `system-components/pennyworth` に変更し、バージョンを `0.0.0` に戻す
  （`pennyworth-v0.1.0` から新しいタグ体系で始める。ディレクトリも
  component 名も変わる以上、別コンポーネントとして生まれ変わる扱いにする
  方が `holmes-v0.6.1` の履歴を引き継いだふりをするより一貫している）

### 7. README.md（全面書き換え）

- タイトル、`@holmes` → `@pennyworth` の mention 例、
  `holmes.panicboat.net` → `pennyworth.panicboat.net`
- Manual Setup 手順を新しい secret path に更新:
  - `panicboat/holmes/slack` → `system-components/pennyworth/slack`
  - Alertmanager 用の `aws secretsmanager put-secret-value` 手順は
    `eks/holmesgpt/alertmanager` 向けに書き換え（Terraform が空 secret を
    作らなくなるため、この secret が platform 側で既に存在する前提を
    明記する）
  - GitHub App 手順: secret path を `github-app/holmesgpt-bot` に、
    Slack App 作成手順のアプリ表示名を `Alfred Pennyworth` に

### 8. Slack App 設定（手動、リポジトリ外）

- 表示名を `Alfred Pennyworth` に設定
- Event Subscriptions の Request URL を
  `https://pennyworth.panicboat.net/slack/events` に更新
  （ドメイン切り替えのタイミングに合わせる）

## Testing

- `go build ./... && go vet ./... && go test ./... -v -race -count=1`
  （新 module path・新パッケージ名で解決すること）
- `kubectl kustomize kubernetes/base` と
  `kubectl kustomize kubernetes/overlays/production` をリネーム後の
  ディレクトリで実行し、Deployment/Service/Ingress/Secret 参照がすべて
  `pennyworth`/新 secret path で解決されることを確認
- `terragrunt plan`（新 state key での初期化を確認。旧 state は空のまま
  放置してよい — 実リソースは存在しない）
- Docker イメージのローカル build（`docker build .` → 両バイナリ名が
  `pennyworth-slack`/`pennyworth-alertmanager` になっていること）

## Out of Scope

- HolmesGPT 本体（`panicboat/platform` リポジトリ）側の変更は一切なし。
  `eks/holmesgpt/alertmanager` を含め、platform repo 内のファイルは
  この spec の対象外。
- secret path の `{product}/{component}/{role}` への統一は、今回
  `system-components/pennyworth/*` にのみ適用する。`panicboat/platform`
  側の他コンポーネント（`oauth2-proxy`, `keycloak`, `grafana` 等）や
  `eks/`  プレフィックス全体への展開は別 issue で扱う。
- GitHub App（`panicboat-holmesgpt-bot`）自体の名前変更は行わない。
  secret path の表記だけを実名に近づける。
- 過去の `docs/superpowers/plans/*holmes*.md` /
  `docs/superpowers/specs/*holmes*-design.md`（完了済みの過去作業の記録）
  は書き換えない。歴史的記録としてそのまま残す。
