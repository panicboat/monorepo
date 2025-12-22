# Change: Implement Nginx Reverse Proxy

## Why
現在、Gateway API を使用して外部トラフィックを直接受け入れていますが、セキュリティと管理の観点から、Nginx をリバースプロキシとして前段に配置する構成に変更する必要があります。これにより、将来的な WAF の導入や詳細なトラフィック制御が可能になります。

## What Changes
- `services/reverse-proxy` に Nginx Pod をデプロイするための仕様を定義します。
- `services/nginx` (App Pod) をテスト用アプリケーションとして、新アーキテクチャに対応するよう設定変更します。
- トラフィックフローを `User -> Cloud LB -> Nginx Pod -> Cilium Gateway -> App Pod` に変更します。

## Impact
- Affected specs: `reverse-proxy`
- Affected code: `services/reverse-proxy`, `services/nginx`
