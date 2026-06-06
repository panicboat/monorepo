# Profile UI Design — rx-sns-faithful view / edit / settings (frontend)

Date: 2026-06-05
Status: Design spec (implementation-ready)
Scope: profile context の frontend UI を rx-sns 踏襲で構築。自分のプロフィール表示 / プロフィール編集モーダル / 設定（エリア・プライバシー・アカウント）/ 公開プロフィール。P5a（data 層）・P5b（form 部品）を消費。
Related: `2026-06-02-profile-slice-design.md`（フィールドセット）、`2026-05-31-domain-context-map-design.md`（keystone）。前提: P1–P4（backend ProfileService）・P5a・P5b 完了。

## Grounding（実物確認）

`.superpowers/rx-sns-render/`（headless capture、gitignore 済）で確認:
- **profile page**: 3 カラム（左ナビ / 中央プロフィール / 右おすすめユーザー）。中央 = cover banner（グラデ）+ 円 avatar（編集 + バッジ重なり）+ 表示名 + ロールバッジ（例「セラピスト」）+ `@username` + 場所（池袋）+ 登録日（2026年5月に登録）+ フォロー中/フォロワー数 + **出勤予定** + 投稿/返信/メディア/いいね タブ + 「プロフィールを編集」ボタン + 共有/embed ボタン。
- **設定 > エリア**（`p04-settings-エリア.png`）: タブ = 通知設定 / **エリア** / 外観 / プライバシー / アカウント。エリア = 「活動エリアを設定してください」+「最大2エリアまで選択できます N/2件選択中」+ **地方アコーディオン**（北海道・東北 / 関東(1) / 甲信越・北陸 / 東海 / 関西 / 中国 / 四国 / 九州・沖縄）→展開 + 保存ボタン。

**正直な制約**: 「プロフィールを編集」モーダルの**厳密なレイアウト画像は手元に無い**（自動化で開けず、フィールドは以前ユーザが送ったスクショ由来で `2026-06-02-profile-slice-design.md` に確定済）。本 spec はそのフィールドセットを使い、配置を定義する。

## IA / surfaces（4 面、rx-sns 踏襲）

| # | 面 | ルート | backend |
|---|---|---|---|
| 1 | 自分のプロフィール | `/profile` | GetProfile |
| 2 | プロフィール編集モーダル | （1 から開く Radix Dialog） | SaveProfile |
| 3 | 設定 | `/settings`（Tabs: エリア / プライバシー / アカウント） | SaveProfile |
| 4 | 公開プロフィール | `/u/[username]` | GetProfileByUsername |

rx-sns の設定タブのうち **通知設定 / 外観 は ProfileService 対象外のため出さない**（defer）。

## Data strategy — full-payload read-modify-write

`SaveProfile` は全フィールド upsert（未指定の `is_private`/`area_ids` は false/空に上書きされる）。分割 UI では各面が部分編集なので、**各面は「現在の `ProfileView` ＋ 自分の編集」を完全ペイロードで送る**ことで clobber を防ぐ。

- 本質: profile は 1 レコード。各編集面は概念上「同じ 1 つの profile を編集して丸ごと保存」する read-modify-write。単一所有レコードの正当な定常形であり、暫定ではない。
- **実装規律**: 各面は profile のロード完了まで保存を無効化する（空 default で他フィールドを上書きしない）。
- 将来 `SaveProfile` を FieldMask/optional 化することは可能で、その移行後も完全ペイロード送信は動作する（superset）ため**非破壊・opt-in**。今は採用しない。

## Surface 1: 自分のプロフィール `/profile`

rx-sns profile page の最小版（`ProfileHeader` コンポーネント）:
- cover（画像 or プレースホルダのグラデ）+ 円 avatar（プレースホルダ）+ 表示名 + ロールバッジ（role）+ `@username` + 場所（prefecture）+ 自己紹介（bio）+ website + SNS リンク（設定済のもの）。
- cast（role=cast）は追加で 年齢 / 身長 / カップ / 業種 / 活動エリア を表示。
- 「プロフィールを編集」ボタン → Surface 2 モーダル。「設定」導線 → `/settings`。
- **defer**: 投稿/返信/メディア/いいね タブ + フィード（posts スライス未構築）、出勤予定（spec で defer）、フォロー中/フォロワー数（relationship/social 未構築）。

## Surface 2: プロフィール編集モーダル

Radix Dialog（`@radix-ui/react-dialog` 導入済）。role-aware。P5b の `FormField`/`Input`/`Textarea`/`Select` を使用。

- **共通**: 表示名（Input, 必須）/ 自己紹介（Textarea, max 160, カウンタ）/ 場所（Select 都道府県）/ website（Input）/ SNS（X / Instagram / TikTok / Bluesky / LINE、Input×5）。
- **cast extras**（role=cast のみ）: 年齢（Input number）/ 身長（Input number）/ カップ（Select）/ 業種（Select）。
- **画像（avatar/cover）は本面では扱わない → P5f**。
- 保存 = 現在 `ProfileView` ＋ 編集を完全ペイロードで `useProfile().saveProfile()`（PUT `/api/profile`）→ SWR mutate → モーダルを閉じる。
- role は `useAuthStore(selectRole)`。

## Surface 3: 設定 `/settings`（Tabs: エリア / プライバシー / アカウント）

既存 `Tabs` で 3 タブ。各タブ保存も**完全ペイロード**（`useProfile` の現在値 ＋ 当該タブの編集）。

- **エリア**（cast）: 地方アコーディオン（8 地方）→ 展開 → 都道府県 → エリア（leaf, name）をチェック、**最大 2**、「N/2件選択中」表示、保存 → `area_ids`。`useAreas()`（`/api/areas`）の結果を `region` → `prefecture` → `name` でグルーピング。`AreaAccordion` コンポーネント。
- **プライバシー**: 鍵アカウント（`Toggle`）→ `is_private`。
- **アカウント**: username（Input）+ 空き確認（`checkUsernameAvailability`, debounce）→ `username`。email/password は identity（別スライス、リンクのみ）。

## Surface 4: 公開プロフィール `/u/[username]`

`usePublicProfile(username)`（`/api/profile/by-username/[username]`）。Surface 1 の `ProfileHeader` を**公開モード**（編集ボタンなし）で再利用。
- フォローボタン・鍵アカウントの follow-gate は relationship/social 未構築のため **defer**（本人/公開の最小表示）。

## Role handling

`useAuthStore(selectRole)` の `role`。cast extras（モーダル）と エリアタブ（設定）は role=cast のみ表示。guest は共通フィールドのみ。

## Components

- 既存: `Button` / `Input` / `Toggle` / `Avatar` / `Tabs` / Radix Dialog + P5b（`Textarea` / `Select` / `Label` / `FormField`）。
- 新規: `ProfileHeader`（view、own/public 両用）/ `EditProfileModal` / `AreaAccordion` / 設定タブの各パネル。

## Image upload（deferred → P5f）

media flow: `getUploadUrl`（presigned）→ client が PUT でファイルアップロード → `registerMedia` → `media_id` → `SaveProfileMedia`（avatar/cover）。旧 onboarding（`/api/media/upload-url`, `/api/media/register`, `useCastImages`）を前例として踏襲。円クロップは将来。

## Decomposition（increments）

- **P5c**: `/profile`（最小ビュー `ProfileHeader`）+ プロフィール編集モーダル（テキスト/セレクト、画像なし）→ SaveProfile（完全ペイロード）。
- **P5d**: `/settings`（エリア / プライバシー / アカウント、`AreaAccordion` + username 空き確認）。
- **P5e**: `/u/[username]` 公開ビュー（`ProfileHeader` 再利用）。
- **P5f**: 画像アップロード（avatar/cover、media flow）をモーダル + ビューに追加。

## Verification

frontend にテストランナー無し → `pnpm build`（型）+ **ブラウザ実機確認**（dev サーバで `/profile`・モーダル・`/settings` を操作、各 increment で screenshot）。

## Deferred / out of scope

- 通知設定 / 外観 タブ（backend 無し）、出勤予定、投稿/フィードタブ、フォロー数/フォローボタン/鍵 follow-gate（relationship/social 未）、username 再利用 cooldown、画像クロップ、email/password 編集（identity）。
