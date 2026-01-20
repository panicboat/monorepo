## ADDED Requirements

### Requirement: Incremental Onboarding Persistence (MUST)
システムは、キャストのオンボーディングプロセスにおいて、各ステップごとにユーザーの入力データをサーバーに永続化しなければならない (MUST)。

#### Scenario: Data Saving per Step
- **Given** オンボーディング中のユーザーであるとき
- **When** 任意のステップ（例：プロフィール入力）を完了して「次へ」を押すと
- **Then** 入力されたデータがサーバーに保存される

### Requirement: Independent Plan Management (MUST)
プラン情報（Plans）は、プロフィール情報とは独立したエンティティとして管理・永続化されなければならない (MUST)。

#### Scenario: Plan Persistence
- **Given** プラン入力ステップにいるユーザーであるとき
- **When** 複数のプランを入力して保存すると
- **Then** プロフィール情報とは別に、関連付けられたプランデータとしてDBに保存される

### Requirement: Resumption Flow (MUST)
システムは、ユーザーがオンボーディングを中断した場合でも、前回の続きから再開できなければならない (MUST)。

#### Scenario: Resume from Interruption
- **Given** オンボーディングを途中まで進めたユーザーであるとき
- **When** 再度オンボーディングページにアクセスすると
- **Then** 前回保存されたデータがフォームに入力された状態で表示される

### Requirement: Authenticated Steps (MUST)
オンボーディングの各入力ステップは、サーバーへのデータ保存を行うため、認証済みユーザーのみがアクセス可能でなければならない (MUST)。

#### Scenario: Unauthenticated Access
- **Given** 未ログインのユーザーであるとき
- **When** オンボーディングの入力ステップ（`/cast/onboarding/step-*`）にアクセスしようとすると
- **Then** ログイン画面にリダイレクトされる
