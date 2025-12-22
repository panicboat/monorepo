## ADDED Requirements

### Requirement: Reverse Proxy Traffic Routing
システムは、外部ユーザートラフィックを Nginx 経由でクラスター内ネットワークへルーティングしなければならない（MUST）。

#### Scenario: 正常なトラフィックフロー
- **WHEN** ユーザーがインターネット経由でリクエストを送信する
- **THEN** リクエストは Cloud LoadBalancer に到達する
- **AND** Cloud LoadBalancer は Nginx Pod にトラフィックを転送する
- **AND** Nginx Pod は Internal Cluster Network を通じて Cilium Gateway (ClusterIP) に転送する
- **AND** Cilium Gateway は eBPF Routing により適切な App Pod にリクエストを届ける

### Requirement: Protocol Support
Nginx Reverse Proxy は HTTP および HTTPS トラフィックを処理しなければならない（MUST）。

#### Scenario: HTTPS リクエスト
- **WHEN** ユーザーが HTTPS でリクエストを送信する
- **THEN** Nginx は TLS 終端を行い（またはパススルーし）、バックエンドへ転送する

### Requirement: App Pod Traffic Acceptance
App Pod (`services/nginx`) は、Cilium Gateway からのトラフィックを受け入れ、適切に応答しなければならない（MUST）。

#### Scenario: App Pod への疎通確認
- **WHEN** Reverse Proxy 経由で App Pod へリクエストが到達する
- **THEN** App Pod は 200 OK を返す
- **AND** バックエンドサービスのヘルスチェックが成功する
