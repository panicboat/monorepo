# Tasks

## 1. Trace ID インフラ整備

- [ ] 1.1 フロントエンドのリクエストユーティリティを作成
  - `X-Request-ID` 生成（crypto.randomUUID）
  - `Authorization` ヘッダー付与の共通化
- [ ] 1.2 BFF (API Routes) でのヘッダー伝播処理を共通化
- [ ] 1.3 Backend の Interceptor で `X-Request-ID` を抽出・ログ出力

## 2. 認証ヘッダーの修正

- [ ] 2.1 認証ヘッダーが欠けている箇所を洗い出し
- [ ] 2.2 `/cast/profile/page.tsx` の fetchData で認証ヘッダーを送信
- [ ] 2.3 その他の欠けている箇所を修正

## 3. Backend の対応

- [ ] 3.1 `AuthenticationInterceptor` に `X-Request-ID` 処理を追加
- [ ] 3.2 `Current` に `request_id` を追加
- [ ] 3.3 ログ出力に `request_id` を含める

## 4. テスト

- [ ] 4.1 リクエスト・レスポンスに X-Request-ID が含まれることを確認
- [ ] 4.2 ログに X-Request-ID が出力されることを確認
- [ ] 4.3 認証が必要な全エンドポイントで認証ヘッダーが送信されることを確認
