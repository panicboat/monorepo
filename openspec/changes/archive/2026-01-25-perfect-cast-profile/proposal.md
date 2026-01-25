# Perfect Cast Profile Proposal

## Summary

キャストプロフィールのAPI連携を完了し、全てのUIフィールドがバックエンドに対応するようにします。

## Problem

現在のキャストプロフィール実装には以下のギャップがあります:

1. **Protobuf 定義の不足**: `portfolio.v1.CastProfile` に UI で必要な主要フィールド（年齢、身長、血液型、スリーサイズ、タグ）が欠けている
2. **Request メッセージの不足**: `CreateCastProfileRequest` と `SaveCastProfileRequest` にも同様のフィールドが欠けている
3. **Frontend Store の未対応**: `onboarding.ts` の `saveProfile` / `fetchProfile` が新フィールドを送受信していない

## Solution

1. **Protobuf 定義の更新**
   - `CastProfile` に新フィールドを追加
   - `ThreeSizes` メッセージを新規定義
   - `CreateCastProfileRequest` / `SaveCastProfileRequest` に新フィールドを追加

2. **Monolith バックエンドの更新**
   - `CastEntity` とリポジトリで新フィールドを永続化
   - `CastService` で Create/Save 処理を更新

3. **Nyx フロントエンドの更新**
   - 生成された Proto 型を更新
   - `onboarding.ts` で新フィールドの送受信を実装

## Risks

- スキーマの変更は後方互換性を持つ必要があります（現在はプレプロダクションのため影響は限定的）
- 既存のデータがある場合のデータ移行（開発環境のみの想定）
