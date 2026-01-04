---
sidebar_position: 15
---

# Security for JWT

Gateway で JWT 検証を導入すると Backendが x-user-id ヘッダーを無条件に信頼する設計になります。

```ruby
# Backend: Gatewayが注入したヘッダーを信頼
def extract_user_id
  request.metadata['x-user-id']  # これを信じていいの？
end
```

**攻撃シナリオ**：
```
悪意のあるPod → Backend Service に直接アクセス
metadata: { 'x-user-id': '99999' }  # 偽装！
↓
Backendは「Gateway検証済み」と誤認
↓
他人のデータにアクセス成功
```

## 防御戦略

### 1. NetworkPolicy による通信制御（基本）

**NetworkPolicyで「Gatewayからのみ」を強制**：

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-ingress-policy
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  ingress:
  # Cilium Gatewayからのみ許可
  - from:
    - podSelector:
        matchLabels:
          app.kubernetes.io/name: cilium-gateway
    ports:
    - protocol: TCP
      port: 50051

  # App Podからの直接アクセスを明示的に拒否
  # （デフォルトdeny-allの場合は不要）
```

#### CiliumNetworkPolicy でより厳密に

```yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: backend-ingress-strict
spec:
  endpointSelector:
    matchLabels:
      app: backend
  ingress:
  # Gateway のみ許可
  - fromEndpoints:
    - matchLabels:
        app.kubernetes.io/name: cilium-gateway
        io.cilium.k8s.policy.serviceaccount: cilium-gateway
    toPorts:
    - ports:
      - port: "50051"
        protocol: TCP
      rules:
        http:
        - method: POST
          path: "^/.*"  # gRPC path
```

### 2. mTLS（相互TLS認証）- 最強の防御

**Cilium Service Mesh を使用した mTLS**：

```yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: backend-mtls-policy
spec:
  endpointSelector:
    matchLabels:
      app: backend
  ingress:
  - fromEndpoints:
    - matchLabels:
        app.kubernetes.io/name: cilium-gateway
    authentication:
      mode: required  # mTLS必須
  egress:
  - toEndpoints:
    - matchLabels:
        app.kubernetes.io/name: cilium-gateway
    authentication:
      mode: required
```

これにより：
- **証明書ベースの認証**が必須
- 偽装Podは証明書を持っていないのでアクセス不可
- 通信も暗号化される

### 3. Backend 側での二重チェック（Defense in Depth）

**「信頼できる送信元か」を Backend 側でも検証**：

```ruby
module Identity
  module Interceptor
    class Authentication < Gruf::Interceptors::ServerInterceptor
      def call
        # パターン判定
        auth_pattern = determine_auth_pattern

        case auth_pattern
        when :gateway_verified
          # Gateway からの検証済みヘッダー
          user_id = request.metadata['x-user-id']
          validate_gateway_source!  # 送信元検証

        when :direct_jwt
          # 直接JWT（fallback）
          user_id = verify_jwt_and_extract_user_id

        else
          raise Gruf::Error::Unauthenticated, "No valid authentication"
        end

        request.context[:current_user_id] = user_id
        yield
      end

      private

      def determine_auth_pattern
        if request.metadata['x-user-id'].present?
          :gateway_verified
        elsif request.metadata['authorization'].present?
          :direct_jwt
        else
          :none
        end
      end

      def validate_gateway_source!
        # 方法1: Peer証明書の検証（mTLS時）
        peer_identity = request.peer_identity
        unless peer_identity&.include?('cilium-gateway')
          raise Gruf::Error::PermissionDenied, "Untrusted source"
        end

        # 方法2: 特殊なGateway署名ヘッダーの検証
        gateway_signature = request.metadata['x-gateway-signature']
        unless verify_gateway_signature(gateway_signature)
          raise Gruf::Error::PermissionDenied, "Invalid gateway signature"
        end
      end

      def verify_gateway_signature(signature)
        # Gateway 側で生成した HMAC 署名を検証
        # 例: HMAC-SHA256(user_id + timestamp, shared_secret)
        return false unless signature

        user_id = request.metadata['x-user-id']
        timestamp = request.metadata['x-gateway-timestamp']

        expected = OpenSSL::HMAC.hexdigest(
          'SHA256',
          ENV['GATEWAY_SHARED_SECRET'],
          "#{user_id}:#{timestamp}"
        )

        ActiveSupport::SecurityUtils.secure_compare(signature, expected)
      end
    end
  end
end
```

### 4. Gateway 側でのヘッダー署名追加

```yaml
apiVersion: cilium.io/v2
kind: CiliumEnvoyConfig
metadata:
  name: jwt-authn-with-signature
spec:
  resources:
  - "@type": type.googleapis.com/envoy.extensions.filters.http.lua.v3.Lua
    inline_code: |
      function envoy_on_request(request_handle)
        local metadata = request_handle:streamInfo():dynamicMetadata()
        local jwt = metadata:get("envoy.filters.http.jwt_authn")

        if jwt and jwt.jwt_payload then
          local user_id = jwt.jwt_payload.sub
          local timestamp = os.time()

          -- ヘッダー追加
          request_handle:headers():add("x-user-id", user_id)
          request_handle:headers():add("x-gateway-timestamp", tostring(timestamp))

          -- HMAC署名生成（Luaの制限あり、実際はExternal Authz推奨）
          local signature = generate_hmac(user_id .. ":" .. timestamp)
          request_handle:headers():add("x-gateway-signature", signature)

          -- 元のAuthorizationを削除
          request_handle:headers():remove("authorization")
        end
      end
```

## 包括的な防御アーキテクチャ

### レイヤー防御の組み合わせ

```
┌─────────────────────────────────────────────────────┐
│ Layer 1: Network Policy                             │
│ - Gatewayからのみ通信許可                             │
│ - 他のPodからは物理的にブロック                         │
└─────────────────────────────────────────────────────┘
                    ↓ 通過
┌─────────────────────────────────────────────────────┐
│ Layer 2: mTLS (Cilium Service Mesh)                 │
│ - 証明書ベースの相互認証                               │
│ - 偽装Podは証明書を持たないので弾かれる                  │
└─────────────────────────────────────────────────────┘
                    ↓ 通過
┌─────────────────────────────────────────────────────┐
│ Layer 3: Gateway Signature                          │
│ - Gatewayが共有秘密鍵でHMAC署名                        │
│ - Backend側で署名検証                                 │
└─────────────────────────────────────────────────────┘
                    ↓ 通過
┌─────────────────────────────────────────────────────┐
│ Layer 4: Application Logic                          │
│ - user_idを使った認可チェック                          │
│ - リソースへのアクセス権限確認                          │
└─────────────────────────────────────────────────────┘
```

## 実装優先順位

### Phase 1（今すぐ）: NetworkPolicy

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-deny-all-ingress
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  ingress: []  # デフォルトdeny-all
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-allow-from-gateway
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app.kubernetes.io/name: cilium-gateway
    ports:
    - protocol: TCP
      port: 50051
```

**効果**:
- ✅ 不正なPodからの直接アクセスを完全にブロック
- ✅ 実装が簡単
- ⚠️ Gateway内部での脆弱性には無防備

### Phase 2（Gateway導入時）: mTLS

```bash
# Cilium Service MeshのmTLSを有効化
cilium clustermesh enable --service-mesh
```

```yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: backend-mtls-required
spec:
  endpointSelector:
    matchLabels:
      app: backend
  ingress:
  - fromEndpoints:
    - matchLabels:
        app.kubernetes.io/name: cilium-gateway
    authentication:
      mode: required
```

**効果**:
- ✅ 証明書偽造は実質不可能
- ✅ 通信の暗号化も実現
- ⚠️ パフォーマンスへの影響あり（軽微）

### Phase 3（高セキュリティ要件時）: Gateway署名

Backend実装：

```ruby
def validate_gateway_source!
  # 環境変数でmTLS/署名検証を切り替え
  case ENV['AUTH_MODE']
  when 'mtls'
    validate_mtls_peer!
  when 'signature'
    validate_gateway_signature!
  when 'both'
    validate_mtls_peer! && validate_gateway_signature!
  end
end
```

**効果**:
- ✅ 多層防御（Defense in Depth）
- ✅ Gateway自体が侵害された場合の保険
- ⚠️ 実装複雑度が上がる

## App Pod からの直接アクセスをどうするか

### オプション1: App Podも必ずGateway経由（推奨）

```
App Pod → Cilium Gateway → Backend Pod
         (JWT検証済み)
```

NetworkPolicy:
```yaml
# Backend: Gatewayからのみ
# App Pod: どこへでも接続可（Egressは制限なし）
```

### オプション2: App Podには直接許可（2段階認証）

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-allow-app-and-gateway
spec:
  podSelector:
    matchLabels:
      app: backend
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app.kubernetes.io/name: cilium-gateway
  - from:
    - podSelector:
        matchLabels:
          app: nextjs-app
    ports:
    - protocol: TCP
      port: 50051
```

Backend実装:
```ruby
def determine_auth_pattern
  peer_labels = extract_peer_labels  # Ciliumから取得

  if peer_labels['app.kubernetes.io/name'] == 'cilium-gateway'
    :gateway_verified  # x-user-id を信頼
  elsif peer_labels['app'] == 'nextjs-app'
    :direct_jwt  # JWT検証必須
  else
    :unauthorized
  end
end
```

## セキュリティレベル別推奨

| セキュリティ要件 | 実装 | コスト |
|-----------------|------|-------|
| **標準** | NetworkPolicy | 低 |
| **高** | NetworkPolicy + mTLS | 中 |
| **最高** | NetworkPolicy + mTLS + 署名検証 | 高 |
