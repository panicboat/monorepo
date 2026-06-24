# k3d Local Environment

monorepo の frontend / monolith をローカル k3d クラスタにデプロイし、
Cilium Gateway による JWT 検証とヘッダー注入を echo サービスで検証する。

## Prerequisites

| ツール | 用途 |
|--------|------|
| colima | コンテナランタイム（macOS） |
| k3d | Docker ベースのローカル Kubernetes クラスタ |
| kubectl | クラスタ操作 |
| helm | Cilium インストール |
| jq | スクリプト内 JSON パース |
| openssl | RSA 鍵生成 |
| python3 | `up.sh` 内の JWKS 書き換え |

## Usage

**クラスタ起動:**
```bash
k3d/bin/up.sh
```
実行順序: colima 起動 → k3d クラスタ作成 → Gateway API CRDs → Cilium（Helm）
→ Gateway → アプリ（postgres / monolith / frontend / echo）→ JWT 鍵ペア + CiliumEnvoyConfig。

**ゲートウェイ JWT 動作の検証:**
```bash
k3d/bin/verify-gateway.sh
```
クラスタ内 curl で echo サービスに対して3ケースを実行する:
- 有効な JWT → 200 + `x-user-id` ヘッダー
- 期限切れ JWT → 401
- JWT なし → 401

全ケース成功時に `ALL PASS` を出力し exit 0 で終了する。

**frontend 到達確認（クラスタ内から）:**

Gateway Service はセレクターなし（eBPF 管理）のため `kubectl port-forward` は
動作しない。代わりにクラスタ内 curl Pod を使う:

```bash
GW_IP=$(kubectl get svc -n default cilium-gateway-cilium-gateway \
  -o jsonpath='{.spec.clusterIP}')
kubectl run gw-check --rm -i --restart=Never --image=curlimages/curl:8.11.0 -- \
  -s -o /dev/null -w "%{http_code}\n" -H "Host: dystopia.city" "http://$GW_IP/"
# 200 を期待
```

**クラスタ破棄:**
```bash
k3d/bin/down.sh
```

## Structure

```
k3d/
├── bin/
│   ├── up.sh              # クラスタ一括起動
│   ├── down.sh            # クラスタ削除
│   ├── gen-keys.sh        # RSA 鍵ペアと jwks.json 生成
│   ├── sign-jwt.sh        # テスト用 JWT 発行
│   └── verify-gateway.sh  # 3ケース ゲートウェイ検証
├── cluster/
│   └── k3d-config.yaml    # k3d クラスタ定義
├── infra/
│   ├── cilium/values.yaml # Cilium Helm values
│   ├── gateway/           # LB IP プール / GatewayClass / Gateway
│   └── jwt/               # CiliumEnvoyConfig + JWKS
└── apps/                  # postgres / monolith / frontend / echo マニフェスト
```

## JWT Mechanism

`CiliumEnvoyConfig`（`infra/jwt/cilium-envoy-config.yaml`）は service-redirect
リスナーで echo サービスへのトラフィックをインターセプトする。Envoy の
`jwt_authn` フィルターと `claimToHeaders` を使い、検証済み JWT の `sub` クレームを
`x-user-id` ヘッダーにコピーし、`forward: false` でトークン自体をアップストリームに
転送しない。`x-user-id` は検証済み JWT から上書きされるため、クライアントがヘッダーを
直接送信しても偽造できない。

Lua フィルターは使用しない — Cilium の Envoy ビルドに Lua フィルターが含まれていないため。

## Keys

`priv.pem` は gitignore 対象で、コミットしない。`jwks.json`（公開鍵）はコミットする。

`up.sh` は `priv.pem` が存在しない場合のみ（例: フレッシュクローン時）`gen-keys.sh`
を実行し、RSA 鍵ペアを再生成して `jwks.json` と CEC 内の埋め込みモジュラスを同時に
更新する。手動で `gen-keys.sh` を実行した場合は、更新された `jwks.json` を
再コミットしてリポジトリとクラスタの整合性を保つ必要がある。

## Cluster Networking

Cilium が CNI と Gateway API を担当し、`kubeProxyReplacement: true`、
`l7Proxy: true`、Gateway API が有効。k3s 組み込みの kube-proxy は Cilium と
並走し続ける。Gateway は Cilium の LB IPAM（L2 アナウンス付き）で ClusterIP /
LoadBalancer IP を取得する。k3s 組み込みの Flannel・ネットワークポリシー・
Traefik・servicelb はすべて無効化されており、Cilium がネットワークを一元管理する。

## Limitations

ホストのブラウザやホスト上の `curl` からゲートウェイへの直接アクセスは、
現在のクラスタ設定では**利用できない**。k3d クラスタはホストポートマッピング
（例: `--port "80:80@loadbalancer"`）なしで作成されており、k3d の Docker
ブリッジ IP は macOS ホストからルーティング不可。ホストアクセスを有効にするには
クラスタ作成時にそのマッピングが必要で、本環境のスコープ外として明示的に除外している。
frontend の到達確認は上記「frontend 到達確認」のクラスタ内 curl 方式を使う。
