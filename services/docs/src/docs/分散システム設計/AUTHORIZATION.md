---
sidebar_position: 20
---

# Authorization

## 認証 (Authentication) vs 認可 (Authorization)

**認証だけでは不十分**な例：

```ruby
# Business Logic
class CastService
  def get_cast(cast_id)
    # current_user_id = "12345" は分かった
    cast = Cast.find(cast_id)

    # でも、このユーザーはこのキャストを見る権限があるの？
    # → 認可チェックが必要！
    cast
  end
end
```

## 認可レイヤーの追加が必要

### パターン1: サービス層での認可（推奨）

```ruby
# slices/cast/services/get_cast_service.rb
module Cast
  module Services
    class GetCastService
      include Monolith::Current  # user_id, organization_id等

      def call(cast_id)
        cast = Cast.find(cast_id)

        # 認可チェック
        authorize!(cast, :read)

        cast
      end

      private

      def authorize!(resource, action)
        policy = CastPolicy.new(Current.user_id, resource)

        unless policy.public_send("#{action}?")
          raise Gruf::Error::PermissionDenied, "Not authorized"
        end
      end
    end
  end
end
```

### パターン2: Policyオブジェクトパターン

```ruby
# slices/cast/policies/cast_policy.rb
module Cast
  module Policies
    class CastPolicy
      attr_reader :user_id, :cast

      def initialize(user_id, cast)
        @user_id = user_id
        @cast = cast
      end

      # 読み取り権限
      def read?
        # ケース1: 公開キャスト
        return true if cast.public?

        # ケース2: 自分のキャスト
        return true if cast.owner_id == user_id

        # ケース3: 同じ組織のメンバー
        return true if same_organization?

        false
      end

      # 更新権限
      def update?
        cast.owner_id == user_id || admin?
      end

      # 削除権限
      def delete?
        cast.owner_id == user_id || admin?
      end

      private

      def same_organization?
        user = User.find(user_id)
        user.organization_id == cast.organization_id
      end

      def admin?
        user = User.find(user_id)
        user.role == 'admin'
      end
    end
  end
end
```

### パターン3: Pundit Gem の活用（Ruby標準）

```ruby
# Gemfile
gem 'pundit'

# slices/cast/policies/cast_policy.rb
module Cast
  class CastPolicy
    attr_reader :user, :cast

    def initialize(user, cast)
      @user = user
      @cast = cast
    end

    def show?
      cast.public? || cast.owner_id == user.id || same_organization?
    end

    def update?
      cast.owner_id == user.id
    end

    def destroy?
      cast.owner_id == user.id
    end

    class Scope
      def initialize(user, scope)
        @user = user
        @scope = scope
      end

      def resolve
        # ユーザーがアクセス可能なキャストのみ返す
        scope.where(public: true)
             .or(scope.where(owner_id: user.id))
             .or(scope.where(organization_id: user.organization_id))
      end
    end
  end
end

# Service層での使用
class GetCastService
  include Pundit::Authorization

  def call(cast_id)
    cast = Cast.find(cast_id)
    authorize cast, :show?  # Policyチェック
    cast
  end
end
```

## アーキテクチャ全体像の更新

```
┌─────────────────────────────────────────────────────────┐
│ 1. Authentication Layer (認証)                          │
├─────────────────────────────────────────────────────────┤
│ - Cilium Gateway: JWT検証                               │
│ - Backend Interceptor: user_id抽出                      │
│ - Context設定: Current.user_id = "12345"                │
│                                                         │
│ 責任: 「あなたは誰？」に答える                              │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Authorization Layer (認可) ← これが不足！               │
├─────────────────────────────────────────────────────────┤
│ - Policy Objects: リソースごとのアクセス制御                │
│ - Role-Based Access Control (RBAC)                      │
│ - Attribute-Based Access Control (ABAC)                 │
│                                                         │
│ 責任: 「あなたはこれをして良い？」に答える                     │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Business Logic Layer                                 │
├─────────────────────────────────────────────────────────┤
│ - Services: ビジネスロジック実行                           │
│ - Repositories: データアクセス                            │
│                                                         │
│ 前提: 認証・認可が完了している                               │
└─────────────────────────────────────────────────────────┘
```

## 認可戦略の選択肢

### Strategy 1: Role-Based Access Control (RBAC)

```ruby
# ユーザーにロールを割り当て
user.role = 'admin' | 'editor' | 'viewer'

class CastPolicy
  def update?
    ['admin', 'editor'].include?(user.role)
  end
end
```

**利点**: シンプル
**欠点**: 柔軟性が低い（「このキャストだけ編集可能」みたいなのが難しい）

### Strategy 2: Attribute-Based Access Control (ABAC)

```ruby
class CastPolicy
  def update?
    # 複数の属性を組み合わせて判断
    cast.owner_id == user.id ||
    (user.organization_id == cast.organization_id && user.role == 'editor') ||
    user.role == 'admin'
  end
end
```

**利点**: 柔軟
**欠点**: 複雑になりがち

### Strategy 3: Relationship-Based Access Control

```ruby
class CastPolicy
  def update?
    # リレーションシップを見る
    cast.collaborators.include?(user) ||
    cast.owner_id == user.id
  end
end
```

**利点**: 直感的
**欠点**: クエリが重くなる可能性

## Authorization Strategy
認証によって特定されたユーザーが、リクエストされたリソースへのアクセス権限を持つかを検証します。

### A. Policy-Based Authorization
各リソース（Cast, Organization等）に対してPolicyクラスを定義し、CRUD操作ごとの権限を管理します。

```ruby
# slices/cast/policies/cast_policy.rb
module Cast
  module Policies
    class CastPolicy
      def initialize(user_id, cast)
        @user_id = user_id
        @cast = cast
      end

      def read?
        cast.public? ||
        cast.owner_id == user_id ||
        same_organization?
      end

      def update?
        cast.owner_id == user_id
      end
    end
  end
end
```

### B. Service Layer Integration
Serviceレイヤーで認可チェックを実施し、不正なアクセスを早期にブロックします。

```ruby
module Cast
  module Services
    class GetCastService
      def call(cast_id)
        cast = Cast.find(cast_id)
        authorize!(cast, :read)
        cast
      end

      private

      def authorize!(resource, action)
        policy = Policies::CastPolicy.new(Current.user_id, resource)
        raise Gruf::Error::PermissionDenied unless policy.public_send("#{action}?")
      end
    end
  end
end
```

### C. Authorization Patterns
**パターン1: Ownership-Based**
- リソースのownerのみが変更可能
- 例: 自分のキャストのみ編集可能

**パターン2: Organization-Based**
- 同じ組織内のメンバーがアクセス可能
- 例: チームメンバー全員が閲覧可能

**パターン3: Permission-Based**
- 明示的な権限付与が必要
- 例: 特定ユーザーへのコラボレーター権限

### D. Authorization at Different Layers
```
┌────────────────────────────────────────┐
│ gRPC Interceptor: 認証のみ              │
│ - user_idの特定                         │
│ - コンテキストへの設定                    │
└────────────────────────────────────────┘
              ↓
┌────────────────────────────────────────┐
│ Service Layer: 認可チェック              │
│ - Policy評価                           │
│ - アクセス拒否時は即座にエラー             │
└────────────────────────────────────────┘
              ↓
┌────────────────────────────────────────┐
│ Repository/Model: データアクセス         │
│ - 認可済み前提でクエリ実行                 │
└────────────────────────────────────────┘
```

### E. Performance Considerations
認可チェックによるN+1問題を避けるため、バルク操作時はScopeを使用：

```ruby
# ❌ 悪い例: N+1問題
casts.each do |cast|
  authorize!(cast, :read)  # 毎回DBアクセス
end

# ✅ 良い例: Scope使用
authorized_casts = CastPolicy::Scope.new(Current.user_id, Cast.all).resolve
```

## マイクロサービス化での認可の課題

将来的にポリグロット環境になった場合：

### 問題: 認可ロジックの重複

```
Ruby Service:   CastPolicy
Go Service:     cast_policy.go
Rust Service:   cast_policy.rs
Node Service:   CastPolicy.ts

→ 全て同じロジックを実装？メンテナンス地獄！
```

### 解決策1: 認可専用サービス（Zanzibar Pattern）

```
┌──────────────────────────────────────┐
│ Authorization Service                │
│ - Google Zanzibar inspired           │
│ - Relationship tuples                │
│ - Check(user, action, resource)      │
└──────────────────────────────────────┘
         ↑
         │ gRPC
         │
┌────────┴────────┬───────────┬────────┐
│ Cast Service    │ User Svc  │ Org Svc│
│ (Ruby)          │ (Go)      │ (Rust) │
└─────────────────┴───────────┴────────┘
```

OSS実装例：
- **Ory Keto**: Zanzibar-style authorization
- **OpenFGA**: Fine-Grained Authorization
- **SpiceDB**: Relationship-based permissions

### 解決策2: Open Policy Agent (OPA)

```yaml
# Rego Policy (言語非依存)
package cast

default allow = false

allow {
  input.action == "read"
  is_public(input.cast)
}

allow {
  input.action == "read"
  input.cast.owner_id == input.user_id
}

allow {
  input.action == "update"
  input.cast.owner_id == input.user_id
}
```

各サービスからOPA APIを呼ぶ：

```ruby
# Ruby
OPA.client.authorize(
  user_id: Current.user_id,
  action: 'read',
  cast: cast.attributes
)

# Go
opa.Authorize(ctx, AuthzRequest{
  UserID: currentUserID,
  Action: "read",
  Cast:   cast,
})
```

## まとめ

### 実装優先順位

Phase 1 (今):
- Monolith内でPolicy Objectパターン実装
- Pundit等の既存Gem活用

Phase 2 (マイクロサービス化時):
- OPA or Zanzibar-style service導入検討
- ポリグロット環境での統一的な認可
