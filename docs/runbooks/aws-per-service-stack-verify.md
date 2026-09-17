# AWS Per-Service Stack Verify — Runbook

> **Scope**: monorepo が所有する per-service Terragrunt stack（`dystopia/infrastructure`,
> `system-components/{service}/infrastructure`, `tools/{service}/infrastructure`）が、
> その時点の production AWS account に対して実際に apply 済みかを検知・復旧する手順。
>
> **Background**: `panicboat/platform` の `scripts/eks-lifecycle/lib/30-destroy-stacks.sh`
> は `eks-karpenter / eks-holmesgpt / eks-secrets / eks-logs / eks-metrics / eks-traces /
> eks / alb / vpc` の9 stack しか destroy しない。monorepo の存在を一切知らないため、
> この runbook が扱う stack は EKS teardown/recreate では **destroy も verify もされない**。
> 2026-08-21 の account-separation migration（`panicboat/platform` PR #821）で production
> が専用 account に切り替わった際、monorepo 側のこの stack 群は一度も新 account に対して
> apply されないまま27日間放置され、2026-09-17 に `monolith` / `pennyworth-*` の
> Pod が `CreateContainerConfigError` になって初めて発覚した。CI の deploy trigger は
> ファイル変更契機（`workflow-config.yaml` の `stack_conventions` root にマッチする path
> の diff）なので、account が切り替わっても該当 path が変更されない限り再 apply は走らない。

## 1. いつ実行するか

- production の AWS account が変わった時（今回のような account-separation / 移行）
- `panicboat/platform` の `docs/runbooks/eks-production-recreate.md` で EKS cluster を
  recreate した後の健全性確認として
- 原因不明の `CreateContainerConfigError` / `SecretSyncedError` に遭遇した時

## 2. Stack 一覧

`workflow-config.yaml` の `stack_conventions` に登録されている root × 実在する service
ディレクトリの組み合わせが対象。2026-09-17 時点のスナップショット:

| Stack | Terragrunt directory | 管理する AWS resource |
| --- | --- | --- |
| `dystopia/infrastructure` | `dystopia/infrastructure/aws/production` | Cognito User Pool, RDS (`monolith-production`), monolith 用 IAM/Pod Identity, `dystopia/monolith/database`, `dystopia/monolith/billing` |
| `system-components/pennyworth` | `system-components/pennyworth/infrastructure/aws/production` | `system-components/pennyworth/slack`, `github-app/pennyworth-bot` |
| `tools/meeting-translation` | `tools/meeting-translation/infrastructure/aws/production` | meeting-translation 用 IAM/Pod Identity |

新しい service を `dystopia/` `system-components/` `tools/` 配下に追加したら、この表にも
行を追加すること（source of truth は `workflow-config.yaml` の `stack_conventions`、この
表はそれを人間が読める形にした早見表）。

## 3. 検知手順

### 3.1 Terragrunt state の resource 数を確認する

対象 account の credential で、各 stack について:

```bash
cd <stack のディレクトリ>  # 例: dystopia/infrastructure/aws/production
TG_TF_PATH=tofu terragrunt run -- plan 2>&1 | grep -E "will be created|Plan:"
```

- **完了条件**: `Plan: 0 to add, 0 to change, 0 to destroy` であれば apply 済み
- `N to add`（N > 0）が出た場合、そのstackはこのaccountに未applyの疑いが強い
  （§4.1 で復旧する）

state を直接見る場合（credential が backend 読み取り権限を持つ IAM principal であること）:

```bash
aws s3 cp s3://terragrunt-state-<account_id>/<stack のstate key>/terraform.tfstate - \
  | jq '{resources: (.resources | length)}'
```

`resources: 0` は「一度もこの account に apply されていない」ことを示す
（`terragrunt destroy` されて0件になったケースと見分けが付かないため、疑わしい場合は
CloudTrail で対象 secret 名の `DeleteSecret` / `CreateSecret` 有無も確認する）。

### 3.2 ExternalSecret の同期状態を確認する

```bash
kubectl get externalsecrets -A | grep -v SecretSynced
```

- **完了条件**: 出力が空（全て `SecretSynced`）
- `SecretSyncedError` + イベントが `Secret does not exist` → secret container 自体が
  存在しない（§4.1 で stack を apply）
- `SecretSyncedError` + それ以外のメッセージ → container はあるが property/key が
  期待と異なる、または権限不足

```bash
kubectl describe externalsecret <name> -n <namespace> | tail -10
```

### 3.3 Pod の状態を確認する

```bash
kubectl get pods -A | grep -vE 'Running|Completed'
```

`CreateContainerConfigError` の場合、`kubectl get pod <name> -n <namespace> -o json | \
jq '.status.containerStatuses[].state'` で不足している secret 名を特定できる
(`envFrom` は複数 secret を持つ場合があるため、1つ直しても次のエラーで別の secret 名が
出ることがある — 全て解消するまで繰り返す)。

## 4. 復旧手順

### 4.1 Stack が未apply（§3.1 で resource 0 件、または N to add）

対象 account の apply 権限を持つ credential で:

```bash
cd <stack のディレクトリ>
TG_TF_PATH=tofu terragrunt run -- init -upgrade   # 既存 .terraform.lock.hcl が古い provider を
                                                    # 固定していると "must use tofu init -upgrade"
                                                    # で失敗するため毎回 -upgrade を付ける
TG_TF_PATH=tofu terragrunt run -- plan             # 内容を確認してから
TG_TF_PATH=tofu terragrunt run -- apply -auto-approve
```

apply 前に、対象 resource (Cognito User Pool / RDS instance / IAM role 等) が
**すでに AWS 上に実体として存在していないか**を先に確認すること
（state が空でも実体が残っている＝孤立している場合、apply すると別物を重複作成してしまう）。

```bash
aws cognito-idp list-user-pools --max-results 20 --region <region>
aws rds describe-db-instances --region <region>
aws eks list-pod-identity-associations --cluster-name eks-<env> --namespace <namespace>
```

### 4.2 Secret の値を投入する — Terraform 内で完結するもの

`random_password` 等で値自体を Terraform が生成している secret（例:
`dystopia/monolith/database`）は、apply 後の state から組み立てて自動投入できる。
人手が持つ外部認証情報は不要:

```bash
STATE=$(aws s3 cp s3://terragrunt-state-<account_id>/dystopia/infrastructure/production/terraform.tfstate - 2>/dev/null)
DB_PASS=$(echo "$STATE" | jq -r '.resources[] | select(.type=="random_password" and .name=="monolith_db_master") | .instances[0].attributes.result')
DB_HOST=$(echo "$STATE" | jq -r '.resources[] | select(.type=="aws_db_instance" and .name=="monolith") | .instances[0].attributes.address')
DB_PORT=$(echo "$STATE" | jq -r '.resources[] | select(.type=="aws_db_instance" and .name=="monolith") | .instances[0].attributes.port')
DB_NAME=$(echo "$STATE" | jq -r '.resources[] | select(.type=="aws_db_instance" and .name=="monolith") | .instances[0].attributes.db_name')
DB_USER=$(echo "$STATE" | jq -r '.resources[] | select(.type=="aws_db_instance" and .name=="monolith") | .instances[0].attributes.username')

aws secretsmanager put-secret-value \
  --secret-id dystopia/monolith/database \
  --secret-string "$(jq -n --arg url "postgres://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}" '{url: $url}')" \
  --region <region>

unset STATE DB_PASS
```

### 4.3 Secret の値を投入する — 外部認証情報が必要なもの

以下は Terraform では生成できず、実際のサービス（Stripe / Slack / GitHub）から取得した
値を人手で投入する必要がある。JSON のキー名は対応する `ExternalSecret.spec.data[].
remoteRef.property` と一致させること（`kubernetes/overlays/production/external-secret*.yaml`
参照）。

**`dystopia/monolith/billing`**（keys: `stripe_api_key`, `stripe_webhook_secret`,
`stripe_price_id_guest`, `stripe_price_id_cast`, `billing_success_url`,
`billing_cancel_url`, `billing_portal_return_url`）

```bash
aws secretsmanager put-secret-value --region ap-northeast-1 \
  --secret-id dystopia/monolith/billing \
  --secret-string "$(jq -n \
    --arg stripe_api_key        '<sk_live_...>' \
    --arg stripe_webhook_secret '<whsec_...>' \
    --arg stripe_price_id_guest '<price_...>' \
    --arg stripe_price_id_cast  '<price_...>' \
    --arg billing_success_url   'https://dystopia.city/billing/success' \
    --arg billing_cancel_url    'https://dystopia.city/billing/cancel' \
    --arg billing_portal_return_url 'https://dystopia.city/billing' \
    '{stripe_api_key:$stripe_api_key, stripe_webhook_secret:$stripe_webhook_secret, stripe_price_id_guest:$stripe_price_id_guest, stripe_price_id_cast:$stripe_price_id_cast, billing_success_url:$billing_success_url, billing_cancel_url:$billing_cancel_url, billing_portal_return_url:$billing_portal_return_url}')"
```

**`system-components/pennyworth/slack`**（keys: `signing_secret`, `bot_token`）

```bash
aws secretsmanager put-secret-value --region ap-northeast-1 \
  --secret-id system-components/pennyworth/slack \
  --secret-string "$(jq -n \
    --arg signing_secret '<Slack Basic Information の Signing Secret>' \
    --arg bot_token      'xoxb-...' \
    '{signing_secret:$signing_secret, bot_token:$bot_token}')"
```

**`github-app/pennyworth-bot`**（keys: `app_id`, `private_key`, `installation_id`。
`private_key` は PEM を改行込みでそのまま渡してよい）

```bash
PRIVATE_KEY=$(cat /path/to/pennyworth-bot.private-key.pem)
aws secretsmanager put-secret-value --region ap-northeast-1 \
  --secret-id github-app/pennyworth-bot \
  --secret-string "$(jq -n \
    --arg app_id '<App ID>' \
    --arg installation_id '<Installation ID>' \
    --argjson private_key "$(jq -Rs . <<<"$PRIVATE_KEY")" \
    '{app_id:$app_id, private_key:$private_key, installation_id:$installation_id}')"
unset PRIVATE_KEY
```

### 4.4 反映を待たずに ExternalSecret を再同期する

`refreshInterval: 1h` を待たなくても、annotation を変えれば即座に再同期される:

```bash
kubectl annotate externalsecret <name> -n <namespace> force-sync=$(date +%s) --overwrite
```

## 5. Verification

```bash
kubectl get externalsecrets -A | grep -v SecretSynced   # 空であること
kubectl get pods -A | grep -vE 'Running|Completed'       # 空であること
```

## 6. References

- `panicboat/platform` `docs/runbooks/eks-production-recreate.md` — EKS cluster 自体の
  destroy/recreate 手順（本 runbook が扱う stack はこのフローの対象外）
- `panicboat/platform` PR #821 — production account-separation migration
  （本 incident の直接の引き金）
- `panicboat/platform` `scripts/eks-lifecycle/lib/30-destroy-stacks.sh` — EKS teardown が
  destroy する9 stack の実体（monorepo 側 stack はここに含まれないことの根拠）
- `workflow-config.yaml` — `stack_conventions` の root 定義（本 runbook §2 の表の
  source of truth）
