# Database Schema Integrity Specification

## MODIFIED Requirements

### Requirement: Cross-Schema Reference Handling

クロススキーマの参照は、データベースレベルの FK 制約ではなく、アプリケーションレベルで管理する (MUST)。

#### Scenario: Comment creation with valid user

- **Given** Identity ドメインに user_id `U1` が存在する
- **When** Post ドメインでコメントを作成する（user_id: `U1`）
- **Then** コメントが正常に作成される

#### Scenario: Comment creation with invalid user

- **Given** Identity ドメインに user_id `U999` が存在しない
- **When** Post ドメインでコメントを作成する（user_id: `U999`）
- **Then** バリデーションエラー（InvalidReferenceError）が発生する
- **And** コメントは作成されない

#### Scenario: Plan creation with valid cast

- **Given** Portfolio ドメインに cast_id `C1` が存在する
- **When** Offer ドメインでプランを作成する（cast_id: `C1`）
- **Then** プランが正常に作成される

#### Scenario: Plan creation with invalid cast

- **Given** Portfolio ドメインに cast_id `C999` が存在しない
- **When** Offer ドメインでプランを作成する（cast_id: `C999`）
- **Then** バリデーションエラー（InvalidReferenceError）が発生する
- **And** プランは作成されない

#### Scenario: Schedule creation with valid cast

- **Given** Portfolio ドメインに cast_id `C1` が存在する
- **When** Offer ドメインでスケジュールを作成する（cast_id: `C1`）
- **Then** スケジュールが正常に作成される

#### Scenario: Schedule creation with invalid cast

- **Given** Portfolio ドメインに cast_id `C999` が存在しない
- **When** Offer ドメインでスケジュールを作成する（cast_id: `C999`）
- **Then** バリデーションエラー（InvalidReferenceError）が発生する
- **And** スケジュールは作成されない

---

### Requirement: Index Maintenance

FK 制約削除後も、参照カラムのインデックスは維持する (MUST)。

#### Scenario: Index exists after FK removal

- **Given** FK 制約 `post_comments_user_id_fkey` が削除された
- **Then** `post.comments.user_id` にインデックスが存在する

#### Scenario: Query performance maintained

- **Given** FK 制約が削除された
- **When** user_id による comments のフィルタリングを行う
- **Then** インデックスが使用される

---

## REMOVED Requirements

### Requirement: Database-Level Foreign Key Constraints (Cross-Schema)

以下の FK 制約を削除する:

- `post_comments_user_id_fkey`: `post.comments.user_id` → `identity.users.id`
- `cast_plans_cast_id_fkey`: `offer.cast_plans.cast_id` → `portfolio.casts.id`
- `cast_schedules_cast_id_fkey`: `offer.cast_schedules.cast_id` → `portfolio.casts.id`

---

## Related Specifications

- [monolith-slices](../../../specs/monolith-slices/spec.md) - スライス分離の原則
- [post-comments](../../../specs/post-comments/spec.md) - コメント機能
- [offer](../../../specs/offer/spec.md) - プラン・スケジュール機能
