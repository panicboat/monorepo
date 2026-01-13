# Proposal: Identity System Overhaul

## Background
現在、MonolithのIdentityサービスはEmail/Passwordを使用していますが、Frontend (Nyx) はモックのPhone/OTP実装を使用しています。この2つの間に大きなギャップがあります。ユーザーは、電話番号での登録（SMS認証付き）とパスワードでのログインを使用する、本番環境対応の実装を求めています。

## Goal
以下の機能をサポートする堅牢で本番環境対応のIdentityシステムを構築する:
1.  SMS認証を伴う電話番号によるユーザー登録。
2.  登録時のパスワード設定。
3.  電話番号とパスワードによるユーザーログイン。
4.  JWTと `GetCurrentUser` によるセッション管理。

## Non-Goals
- Google OIDCの実装（将来の検討事項として延期）。
- Emailによる登録（電話番号に置き換え）。

## Strategy
1.  **Proto Definition**: `identity.v1` を更新し、 `SendSms`, `VerifySms`, `RegisterWithPassword`, `LoginWithPhone` をサポートする。
2.  **Backend Implementation**: Monolithに新しいRPCを実装する。
    - ローカル開発用のモックSMSプロバイダ（コンソールログ出力など）を使用。
    - パスワードハッシュ化 (bcrypt) を実装。
    - セッション/トークン生成を実装。
3.  **Frontend Implementation**: 新しいフローに合わせてNyxの画面を更新する。
