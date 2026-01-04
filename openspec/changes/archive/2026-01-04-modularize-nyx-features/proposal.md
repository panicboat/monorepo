# Proposal: Modularize Nyx Features

## Goal
`apps/shell` 内にあるドメイン固有の UI コンポーネントとロジックを抽出し、ワークスペースの `packages/features/` ディレクトリ配下の再利用可能な機能パッケージ（Feature Packages）として切り出す。

## Why
現在、すべての機能ロジック（`cast`, `chat`, `invitation`）が `apps/shell` 内に存在している。この構成では、将来 `apps/admin` (管理画面) などを作成した際にコンポーネントを再利用しにくい。

目指す構成は以下の通り：

```text
web/nyx/workspace/
├── apps/
│   └── shell/          <-- "容器"。ルーティングとページ構成のみを担当。
│       ├── package.json
│       └── src/app/    <-- pages/app routerのみ。中身はpackagesからimportするだけ。
└── packages/
    ├── ui/             <-- 汎用UI (Buttonなど)
    └── features/       <-- ★ここを作成★
        ├── cast/       <-- Cast機能の全て（UI, Logic, API Hooks）
        ├── chat/       <-- Chat機能の全て
        └── invitation/ <-- Invitation機能の全て
```

機能をパッケージとしてモジュール化することで、関心の分離とスケーラビリティを促進する。ディレクトリ整理だけで済ませずパッケージ化する理由は、**将来的な複数アプリ間でのコード共有**を可能にするためである。

## Changes

### 1. Create Feature Packages
`packages/features/` に以下のパッケージを作成する：
- **`@feature/cast`**: キャストのオンボーディング、プロフィール、管理用コンポーネント。
- **`@feature/chat`**: チャットインターフェースと入力用コンポーネント。
- **`@feature/invitation`**: 招待状（カード、モーダル）処理用コンポーネント。

### 2. Move Components
`apps/shell/src/components/features/*` をそれぞれのパッケージにリファクタリングする。
- `OnboardingWizard`, `PhotoUploader` -> `@feature/cast` へ移動
- `ChatInput`, `MessageBubble` -> `@feature/chat` へ移動
- `InvitationCard`, `RitualModal` -> `@feature/invitation` へ移動

### 3. Update Consumers
`apps/shell` がローカルディレクトリではなく、新しいパッケージからこれらのコンポーネントをインポートするように更新する。

## Verification
- **Build**: すべてのパッケージとアプリで `turbo build` が成功することを確認する。
- **Runtime**: Next.js アプリ (`apps/shell`) が正常に動作し (`dev`)、機能（フォーム、チャット入力）が以前と同様に機能することを確認する。
