# k3d Local Development Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** monorepo の frontend / monolith を k3d 上にデプロイし、Cilium Gateway(Envoy) による「JWT 署名検証 → 信頼ヘッダー注入」を `monorepo/k3d/` 配下のツールで再現・検証できるようにする。

**Architecture:** k3d で最小クラスタを作り、CNI / Gateway を Cilium に一本化する。frontend / monolith / postgres / echo を kustomize でデプロイし、`CiliumEnvoyConfig`(jwt_authn + Lua) を echo Service に当てて、クラスタ内 curl の3ケース判定で Gateway 単体のヘッダー注入挙動を検証する。

**Tech Stack:** k3d v5.9, k3s, Cilium(Helm, Gateway API + Envoy), Gateway API CRDs, kustomize(`kubectl apply -k`), PostgreSQL 17, openssl(RS256 署名), python3, bash。

## Global Constraints

- 出力言語は日本語、コード内要素（変数・関数・コメント・コミットメッセージ）は英語。spec のドキュメントルールに従う（what / why を書き、when / future は書かない）。
- コミットは Conventional Commits、`-s`（signoff）付与、`Co-Authored-By` 禁止。
- コンテナランタイムは **colima**（docker socket `unix://$HOME/.colima/default/docker.sock`）。`up.sh` はクラスタ作成前に colima 稼働を確認・起動する。`docker` CLI は存在しない前提でスクリプトを書く。
- コンテナイメージは ghcr から pull する: `ghcr.io/panicboat/monorepo/frontend:latest` / `ghcr.io/panicboat/monorepo/monolith:latest`（共に public・pull 可を確認済み）。`imagePullPolicy: IfNotPresent`。
- 全 k8s リソースは namespace `default`（base マニフェスト・Gateway の前提に合わせる）。
- クラスタ名 `panicboat-local`。Gateway 名 `cilium-gateway`(default)、HTTP listener。host アクセスは `kubectl port-forward`。
- 既存の `services/{frontend,monolith}/kubernetes/base` は変更しない。ローカル固有差分は全て `monorepo/k3d/apps/<svc>/` の overlay 側に置く。
- 利用可能ツール: k3d v5.9.0 / kubectl v1.36 / helm v4.2.2 / jq / openssl 3.6.2 / python3 3.14.6。`docker` CLI と `cilium` CLI は無い前提（kubectl の wait/rollout で代替）。

## Refinements from spec（理由付きの実装時調整）

spec（`docs/superpowers/specs/2026-06-23-k3d-local-env-design.md`）からの逸脱を明示する。いずれも k3d での堅牢性・Cilium の実機制約に基づく:

1. **kube-proxy は維持する**（spec §6 は「kube-proxy 無効」だった）。理由: kube-proxy を無効化すると Cilium の `kubeProxyReplacement=true` が必須になり、k3d では `k8sServiceHost` 解決が環境依存で不安定。flannel / traefik / servicelb / 組込み NetworkPolicy のみ無効化し、CNI を Cilium に一本化しつつ kube-proxy はそのまま使う。Cilium は `kubeProxyReplacement=false` で導入。
2. **ヘッダー注入の検証経路は HTTPRoute ExtensionRef ではなく `CiliumEnvoyConfig` の service-redirect**（spec §8.4 / §9 は echo に HTTPRoute を生やす想定だった）。理由: AUTHENTICATION.md が示す「HTTPRoute filter ExtensionRef → CiliumEnvoyConfig」は現行 Cilium Gateway API では未サポートの可能性が高い。`CiliumEnvoyConfig` の `services` redirect で echo Service 宛トラフィックを Envoy に通し、jwt_authn + Lua を実行させる。検証対象（Envoy が検証・注入する挙動）は同一で忠実。
3. **検証の curl はクラスタ内から echo Service ClusterIP に対して行う**。理由: service-redirect は ClusterIP 宛トラフィックを Envoy に redirect するため、pod IP を直接叩く port-forward では intercept されない。`kubectl run` の一時 curl pod から `http://echo/` を叩く。

> M2（Task 8）は Cilium-on-k3d / CiliumEnvoyConfig の実機挙動に依存する**実証タスク**。starting config は実在の完全な内容を載せるが、Envoy の cluster 名・dynamic metadata キーは実機で config dump を見て iterate する手順を含める。

---

## File structure

```
monorepo/k3d/
  .gitignore                       # 生成物(private key 等)を除外
  README.md / README-ja.md         # bootstrap / teardown / verify 手順（bilingual）
  cluster/k3d-config.yaml          # k3d クラスタ定義
  infra/
    cilium/values.yaml             # Cilium Helm values
    gateway/gateway-class.yaml     # GatewayClass(cilium)
    gateway/gateway.yaml           # Gateway(cilium-gateway)
    jwt/
      cilium-envoy-config.yaml     # CiliumEnvoyConfig(jwt_authn + Lua)
      jwks.json                    # 公開 JWKS（committed・安全）
  apps/
    kustomization.yaml             # postgres/monolith/frontend/echo を集約
    postgres/{secret,deployment,service,kustomization}.yaml
    monolith/{kustomization,secret,patch-deployment}.yaml
    frontend/{kustomization,configmap,patch-deployment}.yaml
    echo/{deployment,service,kustomization}.yaml
  bin/
    up.sh                          # 冪等 bootstrap
    down.sh                        # クラスタ削除
    gen-keys.sh                    # RSA 鍵ペア生成 + jwks.json + CEC への JWKS 反映
    sign-jwt.sh                    # テスト JWT 発行(RS256)
    verify-gateway.sh              # ヘッダー注入の3ケース判定
```

生成物（`infra/jwt/priv.pem`）は `.gitignore` 対象。`jwks.json` は公開鍵成分のみなので commit して良い。

---

## Task 1: Cluster networking foundation (k3d + Cilium + Gateway)

最小ユニットの成果物 = 「CNI と Gateway が動くクラスタ」。node Ready は CNI 導入後に成立するため、k3d 作成・Cilium 導入・Gateway 適用までを1タスクにまとめる。

**Files:**
- Create: `monorepo/k3d/cluster/k3d-config.yaml`
- Create: `monorepo/k3d/infra/cilium/values.yaml`
- Create: `monorepo/k3d/infra/gateway/gateway-class.yaml`
- Create: `monorepo/k3d/infra/gateway/gateway.yaml`
- Create: `monorepo/k3d/bin/down.sh`
- Create: `monorepo/k3d/bin/up.sh`（このタスクでは preflight + cluster + cilium + gateway まで）

**Interfaces:**
- Produces: クラスタ `panicboat-local`、namespace `default` の Gateway `cilium-gateway`(HTTP listener port 80)、Service `cilium-gateway-cilium-gateway`(後続タスクが port-forward する)。
- Produces: `bin/up.sh`（後続タスクが apps 適用ブロックを追記する土台）、`bin/down.sh`。

- [ ] **Step 1: k3d クラスタ定義を書く**

`monorepo/k3d/cluster/k3d-config.yaml`:
```yaml
apiVersion: k3d.io/v1alpha5
kind: Simple
metadata:
  name: panicboat-local
servers: 1
agents: 0
options:
  k3s:
    extraArgs:
      # Cilium に CNI / LB / NetworkPolicy を一本化するため k3s 内蔵を無効化。
      # kube-proxy は維持する（Refinements from spec #1）。
      - arg: --flannel-backend=none
        nodeFilters: [server:*]
      - arg: --disable-network-policy
        nodeFilters: [server:*]
      - arg: --disable=traefik
        nodeFilters: [server:*]
      - arg: --disable=servicelb
        nodeFilters: [server:*]
```

- [ ] **Step 2: Cilium Helm values を書く**

`monorepo/k3d/infra/cilium/values.yaml`:
```yaml
# kube-proxy を維持するため replacement は無効（Refinements from spec #1）。
kubeProxyReplacement: false
# Gateway API + CiliumEnvoyConfig には Envoy(L7 proxy) が必要。
l7Proxy: true
envoy:
  enabled: true
gatewayAPI:
  enabled: true
ipam:
  mode: kubernetes
operator:
  replicas: 1
```

- [ ] **Step 3: GatewayClass / Gateway を書く**

`monorepo/k3d/infra/gateway/gateway-class.yaml`:
```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: cilium
spec:
  controllerName: io.cilium/gateway-controller
  description: Cilium Gateway Controller
```

`monorepo/k3d/infra/gateway/gateway.yaml`:
```yaml
# Application-shared Gateway。HTTP listener port 80（ローカルは hostNetwork 不要）。
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: cilium-gateway
  namespace: default
spec:
  gatewayClassName: cilium
  listeners:
    - name: http
      port: 80
      protocol: HTTP
      allowedRoutes:
        namespaces:
          from: Same
```

- [ ] **Step 4: down.sh を書く**

`monorepo/k3d/bin/down.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
CLUSTER=panicboat-local
k3d cluster delete "$CLUSTER"
```

- [ ] **Step 5: up.sh（preflight + cluster + cilium + gateway）を書く**

`monorepo/k3d/bin/up.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLUSTER=panicboat-local

echo "==> Preflight: container runtime (colima)"
if ! colima status >/dev/null 2>&1; then
  echo "    colima not running; starting (4 CPU / 8GiB / 60GiB)"
  colima start --cpu 4 --memory 8 --disk 60
fi

echo "==> Cluster: $CLUSTER"
if ! k3d cluster list "$CLUSTER" >/dev/null 2>&1; then
  k3d cluster create --config "$HERE/cluster/k3d-config.yaml"
else
  echo "    exists; reusing"
fi

echo "==> Gateway API CRDs (standard channel v1.2.1)"
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.2.1/standard-install.yaml

echo "==> Cilium (Helm)"
helm repo add cilium https://helm.cilium.io >/dev/null 2>&1 || true
helm repo update >/dev/null
helm upgrade --install cilium cilium/cilium \
  --namespace kube-system \
  -f "$HERE/infra/cilium/values.yaml" \
  --wait --timeout 5m

echo "==> Wait for node Ready"
kubectl wait --for=condition=Ready node --all --timeout=180s

echo "==> Gateway"
kubectl apply -f "$HERE/infra/gateway/gateway-class.yaml"
kubectl apply -f "$HERE/infra/gateway/gateway.yaml"
kubectl wait --for=condition=Programmed gateway/cilium-gateway -n default --timeout=120s

echo "==> Cluster foundation ready"
```

- [ ] **Step 6: 実行して土台を検証する**

```bash
chmod +x monorepo/k3d/bin/up.sh monorepo/k3d/bin/down.sh
monorepo/k3d/bin/up.sh
```
Expected: 最後に `Cluster foundation ready`。続けて:
```bash
kubectl get nodes                                   # STATUS Ready
kubectl -n kube-system get ds cilium                # DESIRED == READY
kubectl get gatewayclass cilium                     # ACCEPTED True
kubectl get gateway cilium-gateway -n default       # PROGRAMMED True
kubectl get pods -A | grep -i traefik || echo "no traefik (expected)"
```
Expected: node Ready、cilium DaemonSet Ready、GatewayClass ACCEPTED、Gateway PROGRAMMED、traefik 不在。

> 失敗時 iterate: cilium-agent が CrashLoop なら `kubectl -n kube-system logs ds/cilium -c cilium-agent` を確認。k3d では稀に bpf/cgroup マウントで失敗するため、その場合は values に `cgroup.autoMount.enabled: true` を追加して再 `helm upgrade`。

- [ ] **Step 7: Commit**

```bash
cd monorepo/.claude/worktrees/feat-k3d-local-env
git add k3d/cluster k3d/infra/cilium k3d/infra/gateway k3d/bin/up.sh k3d/bin/down.sh
git commit -s -m "feat(k3d): bootstrap k3d cluster with cilium gateway"
```

---

## Task 2: PostgreSQL

**Files:**
- Create: `monorepo/k3d/apps/postgres/secret.yaml`
- Create: `monorepo/k3d/apps/postgres/deployment.yaml`
- Create: `monorepo/k3d/apps/postgres/service.yaml`
- Create: `monorepo/k3d/apps/postgres/kustomization.yaml`

**Interfaces:**
- Produces: Service `postgres:5432`、DB `monolith` / user `monolith` / password `monolith`（monolith の `DATABASE_URL` がこれを参照する）。

- [ ] **Step 1: Postgres マニフェストを書く**

`monorepo/k3d/apps/postgres/secret.yaml`:
```yaml
# ローカル専用の固定資格情報（本番は ExternalSecret 経由で別管理）。
apiVersion: v1
kind: Secret
metadata:
  name: postgres
type: Opaque
stringData:
  POSTGRES_USER: monolith
  POSTGRES_PASSWORD: monolith
  POSTGRES_DB: monolith
```

`monorepo/k3d/apps/postgres/deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:17
          envFrom:
            - secretRef:
                name: postgres
          ports:
            - containerPort: 5432
          # データ永続は非ゴール（再現性優先で emptyDir）。
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
          readinessProbe:
            exec:
              command: ["pg_isready", "-U", "monolith", "-d", "monolith"]
            initialDelaySeconds: 5
            periodSeconds: 5
      volumes:
        - name: data
          emptyDir: {}
```

`monorepo/k3d/apps/postgres/service.yaml`:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres
spec:
  selector:
    app: postgres
  ports:
    - protocol: TCP
      port: 5432
      targetPort: 5432
```

`monorepo/k3d/apps/postgres/kustomization.yaml`:
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - secret.yaml
  - deployment.yaml
  - service.yaml
```

- [ ] **Step 2: 適用して検証する**

```bash
kubectl apply -k monorepo/k3d/apps/postgres
kubectl wait --for=condition=Ready pod -l app=postgres --timeout=120s
kubectl exec deploy/postgres -- pg_isready -U monolith -d monolith
```
Expected: pod Ready、`/var/run/postgresql:5432 - accepting connections`。

- [ ] **Step 3: Commit**

```bash
cd monorepo/.claude/worktrees/feat-k3d-local-env
git add k3d/apps/postgres
git commit -s -m "feat(k3d): add local postgres for monolith"
```

---

## Task 3: Monolith (local overlay)

**Files:**
- Create: `monorepo/k3d/apps/monolith/secret.yaml`
- Create: `monorepo/k3d/apps/monolith/patch-deployment.yaml`
- Create: `monorepo/k3d/apps/monolith/kustomization.yaml`

**Interfaces:**
- Consumes: Task 2 の `postgres:5432`。base `services/monolith/kubernetes/base`(Deployment `monolith`, Service `monolith:9001`, ConfigMap `monolith`)。base Deployment は `secretRef: monolith-database` を参照する。
- Produces: Deployment `monolith`、Service `monolith:9001`（frontend が gRPC 呼び出しする）。

- [ ] **Step 1: 平文 DB Secret を書く**

`monorepo/k3d/apps/monolith/secret.yaml`:
```yaml
# 本番 overlay の ExternalSecret(AWS Secrets Manager) をローカルでは平文 Secret に置換。
# 名前は base Deployment の secretRef に合わせ monolith-database。
apiVersion: v1
kind: Secret
metadata:
  name: monolith-database
type: Opaque
stringData:
  DATABASE_URL: postgres://monolith:monolith@postgres:5432/monolith
```

- [ ] **Step 2: Deployment パッチ（image / OTel annotation 除去）を書く**

`monorepo/k3d/apps/monolith/patch-deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: monolith
spec:
  template:
    metadata:
      annotations:
        # OTel operator はローカルに入れないため inject annotation を無効化。
        instrumentation.opentelemetry.io/inject-ruby: "false"
    spec:
      containers:
        - name: monolith
          image: ghcr.io/panicboat/monorepo/monolith:latest
          imagePullPolicy: IfNotPresent
```

- [ ] **Step 3: kustomization を書く**

`monorepo/k3d/apps/monolith/kustomization.yaml`:
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../../services/monolith/kubernetes/base
  - secret.yaml
patches:
  - path: patch-deployment.yaml
```

- [ ] **Step 4: 適用して検証する**

```bash
kubectl apply -k monorepo/k3d/apps/monolith
kubectl rollout status deploy/monolith --timeout=180s
kubectl logs deploy/monolith | head -30
```
Expected: rollout 完了。ログに `Running migrations...` → `Starting gRPC server...`。CrashLoop でないこと。

> 失敗時 iterate: `db migrate` が落ちる場合は `kubectl logs deploy/monolith` の Sequel/Hanami エラーを確認。DB 接続失敗なら Task 2 の Service / `DATABASE_URL` を確認。

- [ ] **Step 5: Commit**

```bash
cd monorepo/.claude/worktrees/feat-k3d-local-env
git add k3d/apps/monolith
git commit -s -m "feat(k3d): deploy monolith against local postgres"
```

---

## Task 4: Frontend (local overlay)

**Files:**
- Create: `monorepo/k3d/apps/frontend/configmap.yaml`
- Create: `monorepo/k3d/apps/frontend/patch-deployment.yaml`
- Create: `monorepo/k3d/apps/frontend/kustomization.yaml`

**Interfaces:**
- Consumes: Task 3 の `monolith:9001`。base `services/frontend/kubernetes/base`(Deployment `frontend`, Service `frontend:80`→3000, ConfigMap `frontend`, HTTPRoute `frontend` host `dystopia.city` → `cilium-gateway`)。Task 1 の Gateway。
- Produces: Deployment `frontend`、Gateway 経由で到達可能な frontend。

- [ ] **Step 1: ConfigMap（MONOLITH_URL）を書く**

base の ConfigMap `frontend` は空。同名 ConfigMap を上書きして `MONOLITH_URL` を入れる。
`monorepo/k3d/apps/frontend/configmap.yaml`:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: frontend
data:
  MONOLITH_URL: http://monolith:9001
```

- [ ] **Step 2: Deployment パッチ（image / OTel annotation 除去）を書く**

`monorepo/k3d/apps/frontend/patch-deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
spec:
  template:
    metadata:
      annotations:
        instrumentation.opentelemetry.io/inject-nodejs: "false"
    spec:
      containers:
        - name: frontend
          image: ghcr.io/panicboat/monorepo/frontend:latest
          imagePullPolicy: IfNotPresent
```

- [ ] **Step 3: kustomization を書く**

同名 ConfigMap `frontend` を base と overlay の両方で定義すると衝突するため、`patchesStrategicMerge` ではなく `configMapGenerator` を使わず、base 側 ConfigMap を overlay の同名リソースで置換する。kustomize は同 GVK+name を patch として扱えないため、ここでは base の configmap をそのまま使い、overlay の configmap.yaml を `patches` で merge する。
`monorepo/k3d/apps/frontend/kustomization.yaml`:
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../../services/frontend/kubernetes/base
patches:
  - path: patch-deployment.yaml
  - path: configmap.yaml
    target:
      kind: ConfigMap
      name: frontend
```

- [ ] **Step 4: 適用して検証する**

```bash
kubectl apply -k monorepo/k3d/apps/frontend
kubectl rollout status deploy/frontend --timeout=180s
# Gateway 経由で到達確認（別ターミナルで port-forward）
kubectl port-forward -n default svc/cilium-gateway-cilium-gateway 8080:80 >/tmp/pf.log 2>&1 &
PF=$!; sleep 3
curl -s -o /dev/null -w "%{http_code}\n" -H 'Host: dystopia.city' http://localhost:8080/
kill $PF
```
Expected: rollout 完了、`200`。

> port-forward 対象 Service 名は環境で異なりうる。`kubectl get svc -n default | grep cilium-gateway` で実名を確認して使う。

- [ ] **Step 5: Commit**

```bash
cd monorepo/.claude/worktrees/feat-k3d-local-env
git add k3d/apps/frontend
git commit -s -m "feat(k3d): deploy frontend wired to monolith"
```

---

## Task 5: Aggregate apps + up.sh orchestration（M1 完了）

**Files:**
- Create: `monorepo/k3d/apps/kustomization.yaml`
- Modify: `monorepo/k3d/bin/up.sh`（apps 適用ブロック追記）

**Interfaces:**
- Consumes: Task 2-4 の各 kustomization。
- Produces: `kubectl apply -k monorepo/k3d/apps` で postgres/monolith/frontend を一括適用。`up.sh` 単体で M1 を再現。

- [ ] **Step 1: apps 集約 kustomization を書く**

`monorepo/k3d/apps/kustomization.yaml`:
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - postgres
  - monolith
  - frontend
```

- [ ] **Step 2: up.sh に apps 適用を追記する**

`monorepo/k3d/bin/up.sh` の末尾 `echo "==> Cluster foundation ready"` の前に挿入:
```bash
echo "==> Apps (postgres / monolith / frontend)"
kubectl apply -k "$HERE/apps"
kubectl wait --for=condition=Ready pod -l app=postgres --timeout=120s
kubectl rollout status deploy/monolith --timeout=180s
kubectl rollout status deploy/frontend --timeout=180s
```

- [ ] **Step 3: クリーンから再現検証する**

```bash
monorepo/k3d/bin/down.sh || true
monorepo/k3d/bin/up.sh
kubectl get pods -n default
kubectl port-forward -n default svc/cilium-gateway-cilium-gateway 8080:80 >/tmp/pf.log 2>&1 &
PF=$!; sleep 3
curl -s -o /dev/null -w "%{http_code}\n" -H 'Host: dystopia.city' http://localhost:8080/
kill $PF
```
Expected: 全 pod Running/Ready、frontend `200`。**M1 完了基準を満たす**。

- [ ] **Step 4: Commit**

```bash
cd monorepo/.claude/worktrees/feat-k3d-local-env
git add k3d/apps/kustomization.yaml k3d/bin/up.sh
git commit -s -m "feat(k3d): orchestrate full M1 stack via up.sh"
```

---

## Task 6: JWT keys + signer

**Files:**
- Create: `monorepo/k3d/bin/gen-keys.sh`
- Create: `monorepo/k3d/bin/sign-jwt.sh`
- Create: `monorepo/k3d/infra/jwt/jwks.json`（gen-keys.sh が生成）
- Create: `monorepo/k3d/.gitignore`

**Interfaces:**
- Produces: `infra/jwt/priv.pem`(gitignored)、`infra/jwt/jwks.json`(public, kid `local`)。`sign-jwt.sh <sub> [exp_seconds]` が RS256 JWT を stdout に出す（iss `local` / aud `monolith`）。Task 8 の CEC が `jwks.json` を `local_jwks` に使う。

- [ ] **Step 1: .gitignore を書く**

`monorepo/k3d/.gitignore`:
```
infra/jwt/priv.pem
```

- [ ] **Step 2: gen-keys.sh を書く（RSA 鍵 + JWKS）**

`monorepo/k3d/bin/gen-keys.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JWT_DIR="$HERE/infra/jwt"
mkdir -p "$JWT_DIR"
KID=local

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

# 2048-bit RSA private key（再生成は冪等）
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$JWT_DIR/priv.pem" 2>/dev/null

# modulus(n) を base64url、exponent(e) は 65537 = AQAB
MOD_HEX=$(openssl rsa -in "$JWT_DIR/priv.pem" -noout -modulus | sed 's/Modulus=//')
N=$(printf '%s' "$MOD_HEX" | xxd -r -p | b64url)
cat > "$JWT_DIR/jwks.json" <<EOF
{"keys":[{"kty":"RSA","kid":"$KID","alg":"RS256","use":"sig","n":"$N","e":"AQAB"}]}
EOF
echo "wrote $JWT_DIR/priv.pem (gitignored) and $JWT_DIR/jwks.json"
```

- [ ] **Step 3: sign-jwt.sh を書く（RS256 署名）**

`monorepo/k3d/bin/sign-jwt.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PRIV="$HERE/infra/jwt/priv.pem"
SUB="${1:-user-123}"
TTL="${2:-3600}"     # 秒。負値で期限切れトークンを作れる
NOW=$(date +%s)
EXP=$((NOW + TTL))

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
HEADER=$(printf '{"alg":"RS256","typ":"JWT","kid":"local"}' | b64url)
PAYLOAD=$(printf '{"iss":"local","aud":"monolith","sub":"%s","iat":%s,"exp":%s}' "$SUB" "$NOW" "$EXP" | b64url)
SIG=$(printf '%s' "$HEADER.$PAYLOAD" | openssl dgst -sha256 -sign "$PRIV" -binary | b64url)
printf '%s.%s.%s\n' "$HEADER" "$PAYLOAD" "$SIG"
```

- [ ] **Step 4: 生成・署名・検証する**

```bash
chmod +x monorepo/k3d/bin/gen-keys.sh monorepo/k3d/bin/sign-jwt.sh
monorepo/k3d/bin/gen-keys.sh
TOKEN=$(monorepo/k3d/bin/sign-jwt.sh user-123)
# payload をデコードして sub を確認
echo "$TOKEN" | cut -d. -f2 | tr '_-' '/+' | base64 -D 2>/dev/null | jq .sub
# 署名を公開鍵で検証（OK が出れば RS256 整合）
H=$(echo "$TOKEN" | cut -d. -f1); P=$(echo "$TOKEN" | cut -d. -f2); S=$(echo "$TOKEN" | cut -d. -f3)
printf '%s' "$H.$P" > /tmp/jwt_signing_input
echo "$S" | tr '_-' '/+' | base64 -D > /tmp/jwt_sig 2>/dev/null
openssl pkeyutl -verify -pubin \
  -inkey <(openssl rsa -in monorepo/k3d/infra/jwt/priv.pem -pubout 2>/dev/null) \
  -sigfile /tmp/jwt_sig -in <(openssl dgst -sha256 -binary /tmp/jwt_signing_input) \
  -pkeyopt digest:sha256 2>/dev/null && echo "SIG OK"
```
Expected: `"user-123"`、`SIG OK`。

- [ ] **Step 5: Commit**

```bash
cd monorepo/.claude/worktrees/feat-k3d-local-env
git add k3d/.gitignore k3d/bin/gen-keys.sh k3d/bin/sign-jwt.sh k3d/infra/jwt/jwks.json
git commit -s -m "feat(k3d): add local rsa keypair and rs256 jwt signer"
```

---

## Task 7: Echo backend

**Files:**
- Create: `monorepo/k3d/apps/echo/deployment.yaml`
- Create: `monorepo/k3d/apps/echo/service.yaml`
- Create: `monorepo/k3d/apps/echo/kustomization.yaml`
- Modify: `monorepo/k3d/apps/kustomization.yaml`（echo 追加）

**Interfaces:**
- Produces: Service `echo:80`。受信ヘッダーを JSON で反射する（`ealen/echo-server`、`.request.headers` に反映）。Task 8 の CEC がこの Service を redirect 対象にする。

- [ ] **Step 1: echo マニフェストを書く**

`monorepo/k3d/apps/echo/deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: echo
spec:
  replicas: 1
  selector:
    matchLabels:
      app: echo
  template:
    metadata:
      labels:
        app: echo
    spec:
      containers:
        - name: echo
          image: ealen/echo-server:0.9.2
          ports:
            - containerPort: 80
          env:
            - name: PORT
              value: "80"
```

`monorepo/k3d/apps/echo/service.yaml`:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: echo
spec:
  selector:
    app: echo
  ports:
    - protocol: TCP
      port: 80
      targetPort: 80
```

`monorepo/k3d/apps/echo/kustomization.yaml`:
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml
```

- [ ] **Step 2: apps 集約に echo を追加する**

`monorepo/k3d/apps/kustomization.yaml` の `resources` に `- echo` を追記する:
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - postgres
  - monolith
  - frontend
  - echo
```

- [ ] **Step 3: 適用して反射を検証する**

```bash
kubectl apply -k monorepo/k3d/apps/echo
kubectl wait --for=condition=Ready pod -l app=echo --timeout=120s
# クラスタ内 curl で Service ClusterIP 経由のヘッダー反射を確認
kubectl run tmp-curl --rm -i --restart=Never --image=curlimages/curl:8.11.0 -- \
  curl -s -H 'x-probe: hello' http://echo/ | jq '.request.headers["x-probe"]'
```
Expected: `"hello"`（echo がヘッダーを反射）。

- [ ] **Step 4: Commit**

```bash
cd monorepo/.claude/worktrees/feat-k3d-local-env
git add k3d/apps/echo k3d/apps/kustomization.yaml
git commit -s -m "feat(k3d): add echo backend for gateway header signal"
```

---

## Task 8: CiliumEnvoyConfig (jwt_authn + Lua header injection)【実証タスク】

**Files:**
- Create: `monorepo/k3d/infra/jwt/cilium-envoy-config.yaml`
- Modify: `monorepo/k3d/bin/up.sh`（CEC への JWKS 反映 + 適用ブロック追記）

**Interfaces:**
- Consumes: Task 6 の `jwks.json`、Task 7 の Service `echo`。
- Produces: echo Service 宛トラフィックを Envoy 経由にし、有効 JWT で `x-user-id` を注入、無効/無トークンで 401 にする。

- [ ] **Step 1: CiliumEnvoyConfig を書く（starting config）**

`monorepo/k3d/infra/jwt/cilium-envoy-config.yaml`（`local_jwks.inline_string` は Step 2 で `jwks.json` から up.sh が上書きする。下記は Task 6 で生成した jwks.json の内容で初期化しておく）:
```yaml
apiVersion: cilium.io/v2
kind: CiliumEnvoyConfig
metadata:
  name: jwt-authn-echo
  namespace: default
spec:
  services:
    - name: echo
      namespace: default
      listener: jwt-authn-listener
  backendServices:
    - name: echo
      namespace: default
      number: ["80"]
  resources:
    - "@type": type.googleapis.com/envoy.config.listener.v3.Listener
      name: jwt-authn-listener
      filterChains:
        - filters:
            - name: envoy.filters.network.http_connection_manager
              typedConfig:
                "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
                statPrefix: jwt_authn
                routeConfig:
                  name: echo_route
                  virtualHosts:
                    - name: echo
                      domains: ["*"]
                      routes:
                        - match:
                            prefix: "/"
                          route:
                            cluster: "default/echo:80"
                httpFilters:
                  - name: envoy.filters.http.jwt_authn
                    typedConfig:
                      "@type": type.googleapis.com/envoy.extensions.filters.http.jwt_authn.v3.JwtAuthentication
                      providers:
                        local:
                          issuer: "local"
                          audiences: ["monolith"]
                          payloadInMetadata: "jwt_payload"
                          fromHeaders:
                            - name: Authorization
                              valuePrefix: "Bearer "
                          localJwks:
                            inlineString: |
                              {"keys":[{"kty":"RSA","kid":"local","alg":"RS256","use":"sig","n":"REPLACED_AT_APPLY","e":"AQAB"}]}
                      rules:
                        - match:
                            prefix: "/"
                          requires:
                            providerName: local
                  - name: envoy.filters.http.lua
                    typedConfig:
                      "@type": type.googleapis.com/envoy.extensions.filters.http.lua.v3.Lua
                      inlineCode: |
                        function envoy_on_request(handle)
                          local meta = handle:streamInfo():dynamicMetadata():get("envoy.filters.http.jwt_authn")
                          if meta ~= nil and meta["jwt_payload"] ~= nil then
                            local sub = meta["jwt_payload"]["sub"]
                            if sub ~= nil then
                              handle:headers():add("x-user-id", sub)
                            end
                          end
                          handle:headers():remove("authorization")
                        end
                  - name: envoy.filters.http.router
                    typedConfig:
                      "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router
```

> 上の `inlineString` 内 `n` は Step 2 で実 JWKS に置換される。committed 値は `jwks.json` の `n` を貼っておく（placeholder ではなく実値）。

- [ ] **Step 2: up.sh に JWKS 反映 + CEC 適用を追記する**

`up.sh` の apps 適用ブロックの後に挿入:
```bash
echo "==> JWT keys + CiliumEnvoyConfig"
[ -f "$HERE/infra/jwt/priv.pem" ] || "$HERE/bin/gen-keys.sh"
# jwks.json を CEC の inlineString に反映してから適用（鍵再生成にも追従）
python3 - "$HERE/infra/jwt/cilium-envoy-config.yaml" "$HERE/infra/jwt/jwks.json" <<'PY'
import sys, json, re
cec_path, jwks_path = sys.argv[1], sys.argv[2]
jwks = open(jwks_path).read().strip()
text = open(cec_path).read()
# inlineString: | ブロック内の JSON 一行を jwks に置換
text = re.sub(r'(inlineString:\s*\|\n)(\s+)\{.*\}', lambda m: f'{m.group(1)}{m.group(2)}{jwks}', text)
open(cec_path, 'w').write(text)
PY
kubectl apply -f "$HERE/infra/jwt/cilium-envoy-config.yaml"
sleep 5
```

- [ ] **Step 3: 適用して3ケースを検証する（iterate ポイント）**

```bash
monorepo/k3d/bin/gen-keys.sh
# up.sh の python 反映と同じ操作を手動実行してから apply（初回検証用）
kubectl apply -f monorepo/k3d/infra/jwt/cilium-envoy-config.yaml
kubectl get ciliumenvoyconfig jwt-authn-echo -n default
sleep 5
TOKEN=$(monorepo/k3d/bin/sign-jwt.sh user-123)
BAD=$(monorepo/k3d/bin/sign-jwt.sh user-123 -3600)   # 期限切れ
run() { kubectl run tmp-$RANDOM --rm -i --restart=Never --image=curlimages/curl:8.11.0 -- "$@"; }
echo "--- valid ---";   run curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $TOKEN" http://echo/
echo "--- inject ---";  run curl -s -H "Authorization: Bearer $TOKEN" http://echo/ | jq '.request.headers["x-user-id"]'
echo "--- expired ---"; run curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $BAD" http://echo/
echo "--- none ---";    run curl -s -o /dev/null -w "%{http_code}\n" http://echo/
```
Expected: valid `200` / inject `"user-123"` / expired `401` / none `401`。

> **iterate（実機差異の解消）**: 期待通りでない場合の調査手順:
> 1. CEC が受理されたか: `kubectl get cec jwt-authn-echo -n default -o yaml` の status を確認。
> 2. Envoy が config を取り込んだか: `kubectl -n kube-system exec ds/cilium-envoy -- cilium-envoy-starter --version` 経路ではなく、`kubectl -n kube-system logs ds/cilium-envoy | tail -50` で reject ログを確認。
> 3. cluster 名: redirect 先 cluster 名が `default/echo:80` でない場合、Envoy config dump（`kubectl -n kube-system exec ds/cilium -- cilium-dbg envoy admin ...` 相当）で実名を確認し routeConfig を修正。
> 4. dynamic metadata キー: `x-user-id` が入らない場合、jwt_authn の metadata namespace（`envoy.filters.http.jwt_authn`）と `payloadInMetadata` キー名を Lua の参照と突き合わせる。
> 5. service-redirect が intercept しない場合（200 だが検証も注入もされない）: Cilium の L7 redirect が効いていない。values で `kubeProxyReplacement: true` + `k8sServiceHost`/`k8sServicePort` を設定して再導入する分岐を試す。

- [ ] **Step 4: Commit**

```bash
cd monorepo/.claude/worktrees/feat-k3d-local-env
git add k3d/infra/jwt/cilium-envoy-config.yaml k3d/bin/up.sh
git commit -s -m "feat(k3d): verify jwt and inject x-user-id via ciliumenvoyconfig"
```

---

## Task 9: verify-gateway.sh（3ケース自動判定 / M2 完了）

**Files:**
- Create: `monorepo/k3d/bin/verify-gateway.sh`

**Interfaces:**
- Consumes: Task 6 の `sign-jwt.sh`、Task 7-8 の echo + CEC。
- Produces: 3ケースを自動判定し、全 PASS で exit 0、いずれか NG で exit 1。

- [ ] **Step 1: verify-gateway.sh を書く**

`monorepo/k3d/bin/verify-gateway.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fail=0
run() { kubectl run "tmp-verify-$RANDOM" --rm -i --restart=Never --image=curlimages/curl:8.11.0 -- "$@"; }

TOKEN=$("$HERE/bin/sign-jwt.sh" user-123)
EXPIRED=$("$HERE/bin/sign-jwt.sh" user-123 -3600)

echo "== case 1: valid JWT -> 200 + x-user-id"
body=$(run curl -s -H "Authorization: Bearer $TOKEN" http://echo/)
uid=$(printf '%s' "$body" | jq -r '.request.headers["x-user-id"] // empty')
if [ "$uid" = "user-123" ]; then echo "  PASS (x-user-id=$uid)"; else echo "  FAIL (x-user-id=$uid)"; fail=1; fi

echo "== case 2: expired JWT -> 401"
code=$(run curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $EXPIRED" http://echo/)
if [ "$code" = "401" ]; then echo "  PASS (401)"; else echo "  FAIL ($code)"; fail=1; fi

echo "== case 3: no JWT -> 401"
code=$(run curl -s -o /dev/null -w "%{http_code}" http://echo/)
if [ "$code" = "401" ]; then echo "  PASS (401)"; else echo "  FAIL ($code)"; fail=1; fi

[ "$fail" = "0" ] && echo "ALL PASS" || { echo "FAILED"; exit 1; }
```

- [ ] **Step 2: 実行して全 PASS を確認する**

```bash
chmod +x monorepo/k3d/bin/verify-gateway.sh
monorepo/k3d/bin/verify-gateway.sh
```
Expected: 3ケース PASS、末尾 `ALL PASS`、exit 0。**M2 完了基準を満たす**。

- [ ] **Step 3: Commit**

```bash
cd monorepo/.claude/worktrees/feat-k3d-local-env
git add k3d/bin/verify-gateway.sh
git commit -s -m "feat(k3d): add gateway header-signing verification script"
```

---

## Task 10: README (bilingual) + final end-to-end

**Files:**
- Create: `monorepo/k3d/README.md`
- Create: `monorepo/k3d/README-ja.md`

**Interfaces:**
- Consumes: 全タスクの成果物。

- [ ] **Step 1: README-ja.md を書く**

`monorepo/k3d/README-ja.md`:
```markdown
# k3d Local Environment

monorepo の frontend / monolith をローカル k3d にデプロイし、Cilium Gateway による JWT 検証→ヘッダー注入を検証する。

## Prerequisites
- colima / k3d / kubectl / helm / jq / openssl / python3

## Usage
- 起動: `bin/up.sh`（colima 起動 → クラスタ作成 → Cilium/Gateway → apps → JWT/CEC）
- 検証: `bin/verify-gateway.sh`（有効JWT→200+x-user-id / 期限切れ→401 / 無→401）
- frontend 到達確認: `kubectl port-forward -n default svc/cilium-gateway-cilium-gateway 8080:80` 後 `curl -H 'Host: dystopia.city' http://localhost:8080/`
- 破棄: `bin/down.sh`

## Structure
- `cluster/` k3d 定義 / `infra/` Cilium・Gateway・JWT(CEC) / `apps/` postgres・monolith・frontend・echo / `bin/` 操作スクリプト

## Notes
- monolith は起動時に `hanami db create && db migrate` を実行（ローカル postgres 必須）。
- 検証は echo Service ClusterIP へのクラスタ内 curl で行う（CiliumEnvoyConfig の service-redirect 経路）。
```

- [ ] **Step 2: README.md（英語）を書く**

`monorepo/k3d/README.md`: README-ja.md の英訳（同じ構成）。bilingual ペア慣習に従う。

- [ ] **Step 3: 完全なクリーン再現を検証する**

```bash
monorepo/k3d/bin/down.sh || true
monorepo/k3d/bin/up.sh
monorepo/k3d/bin/verify-gateway.sh
```
Expected: `up.sh` 完走、`verify-gateway.sh` が `ALL PASS`。M1 + M2 を1コマンド列で再現。

- [ ] **Step 4: Commit**

```bash
cd monorepo/.claude/worktrees/feat-k3d-local-env
git add k3d/README.md k3d/README-ja.md
git commit -s -m "docs(k3d): add bilingual readme for local environment"
```

---

## Self-Review

**1. Spec coverage:**
- §5 Directory layout → Task 1-10 で全ディレクトリ作成。✅
- §6 Cluster → Task 1（kube-proxy 維持は Refinements #1 で明示）。✅
- §7 CNI+Gateway → Task 1。✅
- §8.1-8.4 Apps → Task 2(postgres)/3(monolith)/4(frontend)/7(echo)。✅
- §9 検証(option 1) → Task 6(keys)/8(CEC)/9(verify)。HTTPRoute ではなく CEC service-redirect（Refinements #2/#3）。✅
- §10 Phase 3a → 本計画では対象外（spec 通り後続）。✅
- §11 DX/tooling → Task 5(up.sh)/10(README)。✅
- §12 Success criteria → M1=Task 5、M2=Task 9。✅

**2. Placeholder scan:** CEC の `n` は「実 JWKS 値で初期化し apply 時に再反映」と明示（TODO ではない）。Task 8 の iterate 手順は実証タスクの調査ステップで、未定義の放置ではない。README.md は「README-ja.md の英訳」だが構成は確定。✅

**3. Type consistency:** Secret 名 `monolith-database`（base secretRef と一致）、Service 名 `postgres`/`monolith`/`echo`/`frontend`、`DATABASE_URL`、JWKS kid `local`、metadata namespace `envoy.filters.http.jwt_authn` / payload key `jwt_payload` / 注入ヘッダー `x-user-id` がタスク間で一致。✅

## 既知リスク（実装時に解消する）
- Cilium-on-k3d の bpf/cgroup マウント差異（Task 1 Step 6 に分岐）。
- CiliumEnvoyConfig service-redirect の intercept 成否と cluster 名・metadata キーの実機差異（Task 8 Step 3 の iterate）。
- frontend `200` は標準 build の挙動次第。SSR が monolith 応答に強依存して 5xx になる場合は health/トップの到達確認に緩める。
