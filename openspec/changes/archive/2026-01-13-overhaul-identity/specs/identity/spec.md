# identity Specification Deltas

## MODIFIED Requirements

### Requirement: Robust User Authentication (MUST)
システムは、電話番号とパスワードを利用した堅牢な認証フローを提供しなければならない (MUST)。Google OIDCのサポートは将来の検討事項とする。

#### Scenario: Phone & Password Registration
- **WHEN** ユーザーが電話番号を入力し、SMS認証を完了した後、パワードを設定したとき
- **THEN** 新しいユーザーアカウントが作成され、ログイン状態となる。

#### Scenario: Phone & Password Login
- **WHEN** ユーザーが登録済みの電話番号とパスワードを入力したとき
- **THEN** ユーザーは認証され、有効なセッション（トークン）を取得してログインできる。

#### Scenario: SMS Verification Code
- **WHEN** ユーザーが登録またはパスワードリセットのために電話番号を入力したとき
- **THEN** システムはSMSで検証コード（OTP）を送信し、ユーザーがそれを入力することで所有確認を行う。
