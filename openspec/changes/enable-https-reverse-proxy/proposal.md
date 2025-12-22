# Change: Enable HTTPS on Reverse Proxy

## Why
現在、Reverse Proxy は HTTP (port 80) のみで稼働しており、仕様書にある「HTTPS トラフィックを処理しなければならない」という要件を満たしていません。
セキュリティ強化のため、および仕様準拠のために、HTTPS (port 443) での通信を可能にする必要があります。

## What Changes
- `services/reverse-proxy` に自己署名証明書（開発環境用）または正式な証明書を配置するための仕組み (Secret) を追加します。
- `nginx.conf` (server.conf) を修正し、443ポートでの SSL/TLS 通信を有効化します。
- `Service` 定義を更新し、443ポートを公開します。
- HTTPS へのリダイレクト設定を追加します。

## Impact
- Affected specs: `reverse-proxy`
- Affected code: `services/reverse-proxy`, `clusters/develop`
