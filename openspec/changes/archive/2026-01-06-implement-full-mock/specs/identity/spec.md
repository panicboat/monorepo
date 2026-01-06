## ADDED Requirements

### Requirement: Robust User Authentication (MUST)
システムは、OIDCプロバイダ（特にGoogle）およびSMS認証を利用した堅牢な認証フローを提供しなければならない。

#### Scenario: Google OIDC Login
- **WHEN** ユーザーが「Googleでログイン」を選択したとき
- **THEN** ユーザーはプロバイダにリダイレクトされ、認証され、有効なセッションと共に戻ってくる。

#### Scenario: SMS Verification
- **WHEN** ユーザーが電話番号を提供したとき
- **THEN** SMS経由でOTPが送信され、ユーザーは認証のためにそれを入力しなければならない。

### Requirement: Guest Dashboard (MUST)
ゲストユーザーは、自身の活動履歴やお気に入りキャストを確認できなければならない。

#### Scenario: View Dashboard
- **WHEN** ログイン済みユーザーがマイページにアクセスしたとき
- **THEN** 「お気に入りキャスト」「過去の予約履歴」が表示されるエリアを提供する。
