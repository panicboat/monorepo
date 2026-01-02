---
sidebar_position: 10
---

# Authentication

ログイン後はコンポーネント間の通信で使用する認証トークンとして、JWT を使用します。

## 基礎知識

gRPCはHTTP/2の上に構築されています。

```
┌─────────────────────────┐
│   gRPC Application      │
├─────────────────────────┤
│   gRPC Protocol         │
├─────────────────────────┤
│   HTTP/2                │  ← ここ重要！
├─────────────────────────┤
│   TCP                   │
└─────────────────────────┘
```

gRPCでの「Metadata」= HTTP/2ヘッダー
```ruby
# Ruby (gruf) でのgRPC Metadata送信
client.call(:GetUser, request, metadata: {
  'authorization' => 'Bearer eyJ...',
  'x-user-id' => '12345'
})
```
これは内部的にHTTP/2ヘッダーとして送信されます。

```http
POST /user.UserService/GetUser HTTP/2
Host: backend.example.com
Content-Type: application/grpc
Authorization: Bearer eyJ...
X-User-Id: 12345

[Protobuf binary data]
```

## JWT の検証方法

### パターンA: 直接通信（Service経由、Gatewayを経由しない）

```
┌─────────────────────────────────────────────────────┐
│ App Pod (Next.js BFF)                               │
├─────────────────────────────────────────────────────┤
│ Server Action                                       │
│  ↓                                                   │
│  1. Extract JWT from Cookie                         │
│  2. Add to gRPC Metadata                            │
│     metadata: { authorization: "Bearer ..." }       │
│  ↓                                                   │
│  gRPC Client → backend-service:50051 (直接)         │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ Backend Pod (Hanami gRPC)                           │
├─────────────────────────────────────────────────────┤
│ AuthenticationInterceptor                           │
│  ↓                                                   │
│  1. Extract JWT from metadata['authorization']      │
│  2. Verify JWT                                      │
│  3. Set user_id to context                          │
└─────────────────────────────────────────────────────┘
```

#### 具体例

```typescript
// App Pod内のNext.js Server Action
const client = createPromiseClient(
  UserService,
  createGrpcTransport({
    baseUrl: "http://backend-service:50051",  // 直接Service名
    httpVersion: "2"
  })
);
```

### パターンB: Gateway API で JWT を検証する

```
┌─────────────────────────────────────────────────────┐
│ App Pod (Next.js BFF)                               │
├─────────────────────────────────────────────────────┤
│ Server Action                                       │
│  ↓                                                  │
│  1. Extract JWT from Cookie                         │
│  2. Add to gRPC Metadata                            │
│     metadata: { authorization: "Bearer ..." }       │
│  ↓                                                  │
│  gRPC Client → cilium-gateway (Gateway経由)         │
│               Host: backend.internal                │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ Cilium Gateway (Envoy)                              │
├─────────────────────────────────────────────────────┤
│ JWT Authn Filter                                    │
│  ↓                                                  │
│  1. Extract JWT from metadata['authorization']      │
│  2. Verify JWT (署名、有効期限)                       │
│  3. Inject headers:                                 │
│     x-user-id: "12345"                              │
│     x-organization-id: "org-456"                    │
│  4. Remove authorization header (optional)          │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ Backend Pod (Hanami gRPC)                           │
├─────────────────────────────────────────────────────┤
│ AuthenticationInterceptor (簡略化)                   │
│  ↓                                                  │
│  1. Extract user_id from metadata['x-user-id']      │
│  2. Set to context (JWT検証不要！)                   │
└─────────────────────────────────────────────────────┘
```


#### 具体例

##### Gateway

[platform](https://github.com/panicboat/platform) で定義するため、通常は意識する必要がありません。

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: cilium-gateway
spec:
  gatewayClassName: cilium
  listeners:
  - name: http
    protocol: HTTP
    port: 80
  - name: grpc  # gRPC用リスナー追加
    protocol: HTTP
    port: 50051
```

##### Backend

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: backend-internal-route
spec:
  parentRefs:
  - name: cilium-gateway
    sectionName: grpc  # gRPCリスナー指定
  hostnames:
  - backend.internal
  rules:
  - matches:
    - headers:
      - type: Exact
        name: content-type
        value: application/grpc
    filters:
    # JWT検証とヘッダー注入
    - type: ExtensionRef
      extensionRef:
        group: cilium.io
        kind: CiliumEnvoyConfig
        name: jwt-authn-backend
    backendRefs:
    - name: backend-service
      port: 50051
```

##### gRPC Client

```typescript
// app/actions/user.ts (変更点のみ)
const client = createPromiseClient(
  UserService,
  createGrpcTransport({
    baseUrl: "http://cilium-gateway/",  // ← 変更
    httpVersion: "2",
    interceptors: [(next) => async (req) => {
      req.header.set('authorization', `Bearer ${jwt}`);
      req.header.set('host', 'backend.internal');  // ← 追加
      return next(req);
    }]
  })
);
```

##### gRPC Server

JWT 検証場所に変更があっても影響がないよう以下を参考に実装します。

```ruby
# Backend: 両ケースの対応を実装しておく
def call
  user_id = extract_user_id
  raise Gruf::Error::Unauthenticated unless user_id

  request.context[:current_user_id] = user_id
  yield
end

private

def extract_user_id
  # Gateway 注入ヘッダー（優先）
  if (user_id = request.metadata['x-user-id']).present?
    return user_id
  end

  # 直接 JWT 検証（fallback）
  if (token = request.metadata['authorization']&.sub('Bearer ', ''))
    payload = verify_jwt(token)
    return payload['sub']
  end

  nil
end
```

##### JWT 検証

```yaml
apiVersion: cilium.io/v2
kind: CiliumEnvoyConfig
metadata:
  name: jwt-authn-backend
spec:
  services:
  - name: backend-service
    namespace: default
  resources:
  - "@type": type.googleapis.com/envoy.extensions.filters.http.jwt_authn.v3.JwtAuthentication
    providers:
      auth0:
        issuer: "https://your-auth.com"
        remote_jwks:
          http_uri:
            uri: "https://your-auth.com/.well-known/jwks.json"
            cluster: jwks_cluster
            timeout: 5s
          cache_duration: 300s
        payload_in_metadata: jwt_payload
        from_headers:
        - name: Authorization
          value_prefix: "Bearer "
    rules:
    - match:
        prefix: /
      requires:
        provider_name: auth0
  - "@type": type.googleapis.com/envoy.extensions.filters.http.lua.v3.Lua
    inline_code: |
      function envoy_on_request(request_handle)
        local metadata = request_handle:streamInfo():dynamicMetadata()
        local jwt = metadata:get("envoy.filters.http.jwt_authn")

        if jwt and jwt.jwt_payload then
          local user_id = jwt.jwt_payload.sub
          local org_id = jwt.jwt_payload.org_id

          request_handle:headers():add("x-user-id", user_id)
          if org_id then
            request_handle:headers():add("x-organization-id", org_id)
          end

          -- 元のAuthorizationヘッダーを削除（optional）
          request_handle:headers():remove("authorization")
        end
      end
```

### トレードオフの考慮

| 項目 | 直接通信 | Gateway 経由 |
|------|---------|------------|
| レイテンシ | 低い | やや高い（1ホップ追加） |
| 認証処理 | App 負担 | Infra 負担 |
| ポリグロット対応 | 各言語で実装 | 統一的 |
| 運用複雑度 | 低い | 高い |
