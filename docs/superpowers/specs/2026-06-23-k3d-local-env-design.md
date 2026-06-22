# k3d Local Development Environment + Gateway Header-Signing Verification Design

Date: 2026-06-23
Status: design spec. 後段で implementation plan に分解する。
Scope: monorepo のローカル開発基盤を k3d 上に構築し、frontend / monolith をデプロイした上で、Cilium Gateway による「JWT 検証 → 信頼ヘッダー注入」を検証可能にする。将来この環境を monorepo のローカル開発基盤として育てる前提で、サービス追加が容易な構造を採る。

## 1. Problem statement

monorepo のアプリ（frontend / monolith）は、これまで本番 EKS（`platform` 管理の GitOps）でしか統合動作させられなかった。ローカルで以下を行いたい:

- frontend / monolith を最小構成のクラスタにデプロイして動作確認する。
- `monorepo/docs/分散システム設計/AUTHENTICATION.md` の **パターンB**（Cilium Gateway(Envoy) が JWT 署名を検証し、`x-user-id` 等の信頼ヘッダーを backend に注入する）を、本番に出す前にローカルで検証する。

検証対象の中核は Cilium 固有の `CiliumEnvoyConfig`（Envoy `jwt_authn` フィルタ + Lua ヘッダー注入）であるため、忠実な検証には **Cilium Gateway API をローカルでも動かす**必要がある。k3d 既定の Traefik / flannel では `CiliumEnvoyConfig` を検証できない。

## 2. Goals

1. 最小の k3d クラスタで frontend / monolith を起動し、frontend を Gateway 経由で到達可能にする（M1）。
2. Gateway が JWT 署名を検証し信頼ヘッダーを注入する挙動を、**monolith の稼働状態から切り離した決定的な信号**として検証する（M2）。
3. 将来 monorepo の他サービスを足していける、再現可能で冪等な bootstrap 基盤を `monorepo/k3d/` に整える。
4. 偽造不能な署名ヘッダー（option 3a / ext_authz）へ段階的に拡張できる設計にする（M3、本スコープでは設計のみ）。

## 3. Non-goals

- 本番 EKS の観測スタック（OTel / Prometheus / Loki / Tempo 等）や AWS 固有アドオン（ALB controller / karpenter / external-dns / external-secrets）の再現。ローカルでは持ち込まない。
- TLS / 実 DNS / 実 issuer（Auth0 等）の利用。ローカルは平文 HTTP + 自己署名 JWKS でオフライン完結させる。
- frontend / monolith のアプリ機能の網羅的検証。本スコープは「起動 + Gateway 経路 + ヘッダー注入」の確認に絞る。

## 4. Architecture overview

```
host ──(kubectl port-forward)──▶ cilium-gateway (Envoy, HTTP listener)
                                        │
            ┌───────────────────────────┼────────────────────────────┐
            ▼                           ▼                            ▼
   HTTPRoute: frontend          HTTPRoute: echo               (将来追加サービス)
   (dystopia.city /)            + CiliumEnvoyConfig:
            │                     jwt_authn(local_jwks)
            ▼                     + Lua(sub→x-user-id, authz除去)
        frontend(:3000) ─gRPC─▶ monolith(:9001) ─▶ postgres
                                        │
                                        ▼
                                  echo backend(:80)  ← Gateway単体信号の的
```

- frontend は base の HTTPRoute で `cilium-gateway` 配下に入り、host アクセス確認に使う。
- echo backend は `CiliumEnvoyConfig` を当てる的で、ヘッダー注入の有無を JSON で反射し、**Gateway 単体の信号**を提供する。
- monolith は frontend からの gRPC を受け、Postgres に接続して自己マイグレーション後に gRPC サーバを起動する。

## 5. Directory layout

最小 infra マニフェストは `platform` の cilium コンポーネントから**最小スライスを vendor** し、monorepo 単独で完結させる（`platform` リポジトリへのクロス依存を持たない）。

```
monorepo/k3d/
  README.md / README-ja.md        # bootstrap / teardown / verify 手順（bilingual）
  bin/
    up.sh                         # 冪等: cluster 作成 → Cilium → 待機 → Gateway → apps
    down.sh                       # cluster 削除
    sign-jwt.sh                   # ローカル private key でテスト JWT を発行
    verify-gateway.sh             # ヘッダー注入の3ケース判定（主信号）
  cluster/
    k3d-config.yaml               # traefik/servicelb/flannel/kube-proxy 無効・port map
  infra/
    cilium/values.yaml            # gatewayAPI.enabled / kubeProxyReplacement
    gateway/
      gateway-class.yaml          # GatewayClass(cilium)（platform から適合）
      gateway.yaml                # Gateway(cilium-gateway, default, HTTP listener)
    jwt/
      cilium-envoy-config.yaml    # jwt_authn(local_jwks) + Lua header 注入
      jwks.json                   # 公開鍵（private key は生成物で .gitignore）
  apps/
    kustomization.yaml            # frontend / monolith / postgres / echo を集約
    frontend/                     # services/frontend/kubernetes/base を参照 + 上書き
    monolith/                     # base 参照 + 平文 Secret / external-secret 除外
    postgres/                     # ローカル Postgres + Secret
    echo/                         # echo backend + HTTPRoute
```

サービス追加時は `apps/<svc>/` に overlay を1つ足し `apps/kustomization.yaml` に追記するだけで済む構造とする。

## 6. Cluster (k3d)

- クラスタ名 `panicboat-local`、server 1 台。
- Cilium と競合する k3s 内蔵を無効化する: Traefik、servicelb（klipper）、flannel（`--flannel-backend=none`）、組込み NetworkPolicy、kube-proxy。これらは Cilium が置き換える。
  - why: `CiliumEnvoyConfig` と Gateway を Cilium に担わせるため、CNI / LB / kube-proxy を Cilium に一本化する。flannel と Cilium の二重 CNI は競合する。
- Gateway への host アクセスは `kubectl port-forward` を採用する。
  - why: ローカルでは LoadBalancer IP 割当（L2 アナウンス等）が不安定になりやすく、port-forward が最も確実で DX が安定する。

## 7. CNI + Gateway (Cilium)

- Gateway API CRD を Cilium インストール前に導入する（Cilium の Gateway 機能の前提）。
- Cilium を Helm で導入する。最小値: `gatewayAPI.enabled=true`、`kubeProxyReplacement=true`、k8s API への接続情報。観測系（Hubble 等）は最小構成では無効。
- `GatewayClass: cilium` と `Gateway: cilium-gateway`（namespace `default`、HTTP listener）を適用する。両者は `platform/kubernetes/components/cilium/production/kustomization/` の定義を適合させる。
  - hostNetwork は EKS 固有事情（eks-pod-identity-agent の port 競合回避）なのでローカルでは外す。listener は素直な HTTP ポートにする。
  - why Cilium: 検証対象の `CiliumEnvoyConfig` が Cilium 固有 CRD であり、他 Gateway 実装では同一マニフェストを検証できない。

## 8. Applications

### 8.1 postgres
ローカル Postgres を Deployment + Service + Secret で用意する（`POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD`）。ストレージは最小構成では emptyDir（再現性優先・データ永続は非ゴール）。

### 8.2 monolith
- `services/monolith/kubernetes/base` を参照する overlay。
- image は ghcr から pull（`ghcr.io/panicboat/monorepo/monolith`）。`imagePullPolicy: IfNotPresent`。
- 本番 overlay の `ExternalSecret`（AWS Secrets Manager 参照）は**除外**し、`monolith-database` を**平文 Secret**（`DATABASE_URL` = ローカル Postgres 接続文字列）で置換する。
- `bin/start` が起動時に `hanami db create` / `hanami db migrate` を実行し、その後 `bin/grpc` で gRPC サーバを起動する（自己マイグレーション）。
- OTel / reloader の注入 annotation はローカル overlay で除去する（対応 operator を入れないため）。

### 8.3 frontend
- `services/frontend/kubernetes/base` を参照する overlay。
- image は ghcr から pull（`ghcr.io/panicboat/monorepo/frontend`）。`imagePullPolicy: IfNotPresent`。
- ConfigMap `MONOLITH_URL=http://monolith:9001` を設定する（frontend は monolith を gRPC 呼び出しする BFF）。
- base の HTTPRoute（host `dystopia.city`、`cilium-gateway` 配下）をそのまま使い、host アクセス確認に用いる。
- OTel / reloader の注入 annotation はローカル overlay で除去する。

### 8.4 echo backend
- `ealen/echo-server`（受信リクエストヘッダーを JSON で反射する public image）を Deployment + Service で用意する。
- 専用 HTTPRoute を `cilium-gateway` に生やす（host ベースで frontend と分離）。
- この Service を `CiliumEnvoyConfig` のターゲットにし、Gateway 単体のヘッダー注入信号を取得する的とする。

## 9. Header-signing verification (option 1) — the primary signal

検証対象は AUTHENTICATION.md パターンB の前半（Gateway が JWT 署名を検証し、検証済み payload から信頼ヘッダーを注入する）。

### 9.1 JWT 鍵
- ローカルで RSA 鍵ペアを生成する。
- 公開鍵を JWKS 形式にして `CiliumEnvoyConfig` の `jwt_authn` プロバイダの `local_jwks`（インライン）に埋め込む。
  - why: remote JWKS（実 issuer）はインターネットと実トークンを要し、ローカル検証には重い。`local_jwks` インラインで完全オフライン・再現可能にする。
- private key は `bin/sign-jwt.sh` がテスト JWT 発行に使う生成物で、`.gitignore` 対象。

### 9.2 CiliumEnvoyConfig
- Envoy `jwt_authn` フィルタ: プロバイダは `local_jwks`、`from_headers`（`Authorization: Bearer`）、`payload_in_metadata` に検証済み payload を出す。echo Service をターゲットにする。
- Envoy Lua フィルタ: dynamic metadata から検証済み payload を読み、`sub` を `x-user-id` として注入。`authorization` ヘッダーは除去（パターンB の整理に合わせる）。

### 9.3 Verification signal（`bin/verify-gateway.sh`）
monolith の稼働状態に依存しない、決定的な3ケース判定:

| 入力 | 期待される信号 | 確認できること |
|---|---|---|
| 有効な JWT（`sign-jwt.sh` 発行） | 200 + echo が `x-user-id:<sub>` を反射、`authorization` は無し | 署名検証 → ヘッダー注入が成立 |
| 改ざん / 期限切れ JWT | 401（backend 未到達） | Gateway が署名を強制している |
| トークンなし | 401 | 同上 |

実 monolith のログ（`AuthenticationInterceptor` の `x-user-id` 受信）確認は、経路全体が通ることの**任意の二次確認**に格下げする。

## 10. Phase 3a — signed headers via ext_authz (designed, deferred)

option 1 の弱点は、monolith が `x-user-id` を信頼する根拠が「Gateway 経由でしか到達できない」というネットワーク隔離の前提のみで、別経路からの `x-user-id` 偽造に弱いこと。M3 でこれを偽造不能にする。

- Gateway の **ext_authz** から小さな `signer` サービスを呼ぶ。
- `signer` は JWT を検証し、検証済み identity に対する**署名済みアサーション**（短命の内部 JWT もしくは HMAC ヘッダー）を返す。
- backend は署名を検証してから identity を信頼する。
- why ext_authz: Envoy(Cilium 同梱) は JWT の「検証」は native だが「署名 / 発行」は native でない。Lua / Wasm で HMAC を自前実装するより、ext_authz で署名サービスに委ねる方が明快かつ検証しやすい。

本スコープ（M1 + M2）では設計のみとし、実装は後続フェーズに送る。option 1 の検証経路は option 3a の前半と共通なので、上に積む形で拡張する。

## 11. Developer workflow & tooling

- `bin/up.sh` は冪等にする: クラスタが無ければ作成 → Cilium 導入 → Ready 待機 → Gateway 適用 → apps デプロイ → Pod Ready 待機。タイムアウトと明確な失敗メッセージを持たせる。
- `bin/down.sh` はクラスタを削除する。
- `README.md` / `README-ja.md` に bootstrap / teardown / verify 手順を bilingual で記載する（monorepo の README ペア慣習に従う）。
- 生成物（private key 等）は `.gitignore` に追加する。

## 12. Success criteria

- M1: 全 Pod が Ready。frontend が `cilium-gateway` 経由で 200。monolith ログにマイグレーション完了と gRPC 起動。
- M2: `verify-gateway.sh` の3ケースが期待通り（有効→200+`x-user-id`、改ざん→401、無→401）。
- M3（後続）: 署名済みヘッダーを backend が検証し、署名なしの `x-user-id` を拒否する。

## 13. Risks & open questions

- Cilium Gateway on k3d は LB IP 割当 / kube-proxy 置換まわりが環境依存になりうる。port-forward でアクセス経路を固定してリスクを下げる。
- Cilium 同梱 Envoy の `jwt_authn` / Lua フィルタの細部（`local_jwks` インラインの受理、dynamic metadata のキー名）は実装時に実機検証する。
- echo backend のヘッダー反射が gRPC ではなく HTTP 経路である点に注意する。ヘッダー注入機構は HTTP 層で動くため、Gateway 単体検証は HTTP echo で十分だが、monolith への gRPC 経路でも別途到達確認する。
