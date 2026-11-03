# Environment-free names design

## Context

`docs/superpowers/specs/2026-11-03-dystopia-infrastructure-layers-design.md` で、作り直した VPC と dystopia のリソースから環境名を外した。環境は AWS アカウントで分かれており、名前で区別する必要がない。本 spec は、残る名前から環境名を外す。

`aws/github-oidc-auth` は対象外とする。IAM ロールの名前変更は作り直しになり、CI 自身がそのロールで apply するうえ、3 リポジトリと GCP が ARN を参照するため、切り替えの手間に見合う利点がない。

### Current state (2026-11-04)

| 対象 | 状態 | 確認方法 |
|---|---|---|
| `platform/aws/eks`・`eks-karpenter`・`eks-logs`・`eks-metrics`・`eks-traces`・`eks-secrets`・`eks-holmesgpt`・`alb` | production の state はいずれもリソース 0 | state ファイルの `resources` の件数 |
| `platform/gcp/google-oauth-production/project/master` | 稼働中。state は master アカウント（559744160976）の `platform/gcp/google-oauth-production/project/master/terraform.tfstate` | `aws s3 ls` |
| GCP project `panicboat-platform-auth` | 表示名 `google-oauth-production`。Terraform は表示名を管理していない（`project.hcl` の `project_name` を読む module がない） | コード読解 |
| 旧名の AWS リソース（production） | 名前に `eks`・`Karpenter` を含む IAM ロール・ポリシー、SQS、ロググループ、EKS クラスタはいずれも 0。S3 は `dystopia-media-337169763788` と state バケットのみ | `iam list-roles`・`iam list-policies`・`sqs list-queues`・`logs describe-log-groups`・`eks list-clusters`・`s3 ls` |
| external-dns の所有者 TXT（master の公開ゾーン） | `owner=eks…` の TXT は 0 | `route53 list-resource-record-sets` |

## Goals

- `platform` の EKS 系 stack・kubernetes component・EKS 運用スクリプトと文書の名前から環境名を外す
- GCP project の表示名とディレクトリ名から環境名を外し、state を新しいパスへ移す
- monorepo の EKS 用 configmap の media バケット名を現行のバケット名に合わせる
- `panicboat/dotfiles` の `eks-login` が新しいクラスタ名と管理者ロール名を使う
- Loki・Mimir・Tempo のバケットの保持期限が、バケット内の全オブジェクトに効く

## Non-goals

- `aws/github-oidc-auth` の名前変更
- EKS の再構築
- `clusters/production/` など、環境ごとのディレクトリ構成の変更
- `Environment` タグと state キー（パス由来）の変更。GCP はパスが変わる分だけ変わる
- 過去の spec・plan（`docs/superpowers/`）と CHANGELOG の書き換え

## Anti-goals

- 稼働中の GCP stack が、merge 時に CI の apply で空の state から作り直される
- 名前変更で参照がずれ、EKS を再構築したときに初めて壊れていると分かる（参照元と参照先の片方だけが変わる）

## Decisions

### Decided with the user

| 論点 | 決定 |
|---|---|
| 範囲 | EKS 系・kubernetes・GCP・monorepo の configmap・dotfiles の `eks-login`。`github-oidc-auth` は除く |
| 名前 | 「Naming」の対応表のとおり |
| GCP | 表示名を `google-oauth` に変え、ディレクトリを `gcp/google-oauth/` に移す。project ID `panicboat-platform-auth` は変えられないため変えない |
| バケット内パスの接頭辞 | 削除し、ライフサイクルルールをバケット全体に適用する。バケットはサービス・アカウントごとに分かれており、接頭辞で環境を分ける必要がない。Loki は `bucketPathPrefix` を参照しておらずバケット直下に書くため、`production/` だけを対象にした現行ルールでは期限切れにならない（REASONED、コード読解） |

### Builder's calls made during design

| 論点 | 決定 | 理由 |
|---|---|---|
| `eks/lookup` の入力 | `environment` を削除する | `vpc/lookup` と同じ扱い。名前が固定になり入力が不要 |
| EKS 系 module の `environment` 変数 | 名前以外で使われなくなったものは削除する | `vpc` module・lambda module と同じ扱い |
| `bucket_path_prefix` 出力（eks-logs・metrics・traces） | 削除する | 接頭辞をなくすため。参照元がない（`git grep` で 0 件） |
| EKS 運用スクリプト `scripts/eks-lifecycle` | `eks-${ENV}` を `eks` に変える | クラスタ名に合わせないと teardown が対象を見つけられない |
| README の EKS ログイン手順 | dotfiles の `eks-login` 関数（`! eks-login`）を使う手順に揃える | 手元の実体は `~/.script/eks-login.sh` を読む zsh 関数で、README の `source ~/Workspace/eks-login.sh` は実在しない |
| runbook のファイル名 | `docs/runbooks/eks-production-recreate.md` を `docs/runbooks/eks-recreate.md` に変え、参照を直す | ファイル名にも環境名を入れない |
| GCP の state 移動の時期 | PR を merge する前に新しいキーへコピーする | platform の CI は master 環境を apply するため、merge 時に新しいパスの state が空だと作成から始まる |

## Naming

### platform `aws/`

| 箇所 | 変更前 | 変更後 |
|---|---|---|
| EKS クラスタ（`aws/eks`、`eks/lookup`） | `eks-production` | `eks` |
| EBS CSI のロール | `eks-production-ebs-csi` | `eks-ebs-csi` |
| ALB controller のロール | `eks-production-alb-controller` | `eks-alb-controller` |
| external-dns のロール | `eks-production-external-dns` | `eks-external-dns` |
| Cilium operator のロール | `eks-production-cilium-operator` | `eks-cilium-operator` |
| 管理者ロール | `eks-admin-production` | `eks-admin` |
| Karpenter のノードロールと割り込みキュー | `Karpenter-eks-production` | `Karpenter-eks` |
| system-critical のノードグループ | `eks-production-system-critical` | `eks-system-critical` |
| ESO のロール | `eks-production-eso` | `eks-eso` |
| HolmesGPT のロール | `eks-production-holmesgpt` | `eks-holmesgpt` |
| Loki・Mimir・Tempo のロール | `eks-production-{loki,mimir,tempo}` | `eks-{loki,mimir,tempo}` |
| Loki・Mimir・Tempo のライフサイクルルール | id `production-retention`、対象 `production/` | id `retention`、対象はバケット全体 |
| Loki・Mimir・Tempo のバケット | `{loki,mimir,tempo}-<account>` | 変更なし |

### platform `kubernetes/`

| 箇所 | 変更前 | 変更後 |
|---|---|---|
| ALB controller の `clusterName` とロール ARN | `eks-production` / `…role/eks-production-alb-controller` | `eks` / `…role/eks-alb-controller` |
| external-dns のロール ARN と `txtOwnerId` | `…role/eks-production-external-dns` / `eks-production` | `…role/eks-external-dns` / `eks` |
| Karpenter のクラスタ名・割り込みキュー・EC2NodeClass のタグとロール | `eks-production` / `Karpenter-eks-production` | `eks` / `Karpenter-eks` |
| OpenTelemetry Collector と Tempo の `cluster` ラベル | `eks-production` | `eks` |
| Loki・Mimir・Tempo の `bucketPathPrefix`、Mimir の `storage_prefix`、Tempo の `prefix` | `production` | 削除 |

hydrate 済みの `kubernetes/manifests` は CI の hydrator が更新する。

### platform `gcp/`

| 箇所 | 変更前 | 変更後 |
|---|---|---|
| project の表示名（`gcloud` で変更） | `google-oauth-production` | `google-oauth` |
| ディレクトリ | `gcp/google-oauth-production/` | `gcp/google-oauth/` |
| `project.hcl` の `project_name` | `google-oauth-production` | `google-oauth` |
| state のキー | `platform/gcp/google-oauth-production/project/master/terraform.tfstate` | `platform/gcp/google-oauth/project/master/terraform.tfstate` |
| project ID | `panicboat-platform-auth` | 変更なし |

### monorepo

| 箇所 | 変更前 | 変更後 |
|---|---|---|
| `dystopia/monolith/kubernetes/overlays/production/configmap.yaml` の `MEDIA_BUCKET_NAME` | `dystopia-media-production` | `dystopia-media-337169763788` |

### dotfiles

| 箇所 | 変更前 | 変更後 |
|---|---|---|
| `.script/eks-login.sh` の管理者ロール | `eks-admin-${_env}` | `eks-admin` |
| `.script/eks-login.sh` のクラスタ名 | `eks-${_env}` | `eks` |
| `.script/eks-login.sh` の引数 `_env` | 名前とアカウント・リージョンの選択 | アカウント・リージョンの選択のみ |

## Changes

- `platform/aws/eks*` の module・lookup・tests・README と、`kubernetes/components/*/production`・`kubernetes/README.md`・karpenter の selector テスト、`scripts/eks-lifecycle`・`docs/runbooks` を「Naming」に合わせる
- `platform/gcp/google-oauth-production` を `platform/gcp/google-oauth` に `git mv` し、`project.hcl` と `Makefile` の表示名を直す
- monorepo の configmap を直す
- dotfiles の `.script/eks-login.sh` を直す（dotfiles は PR 経由で変更する）
- 変更後、各リポジトリの `git grep` で `eks-production`・`Karpenter-eks-production`・`eks-admin-production`・`google-oauth-production`・`bucketPathPrefix`、および変数で組み立てる形（`eks-${`・`eks-admin-${`・`Karpenter-eks-${`・`eks-${env}-`）が CHANGELOG と `docs/superpowers` 以外で 0 件になる

## Cutover

1. GCP の state を新しいキーへコピーする: `s3://terragrunt-state-559744160976/platform/gcp/google-oauth-production/project/master/terraform.tfstate` を `…/google-oauth/project/master/terraform.tfstate` へ。完了条件: platform の PR の CI plan で `gcp/google-oauth/project/master` が差分なし
2. platform・monorepo・dotfiles の PR を merge する。AWS の EKS 系 stack は production が CI の対象外で、state も空のため apply は走らない
3. GCP の表示名を変える: `gcloud projects update panicboat-platform-auth --name=google-oauth`。完了条件: `gcloud projects describe` の `name` が `google-oauth`
4. 旧キーの GCP state を削除する

手順 3 は `gcloud` の再認証が要る場合、ユーザーに `! gcloud auth login` を依頼する。

## Left to the builder

- 各 module の tests の期待値の直し方
- S3 module（`terraform-aws-modules/s3-bucket` 5.17.0）でバケット全体を対象にするライフサイクルルールの書き方
- README・runbook の文言
