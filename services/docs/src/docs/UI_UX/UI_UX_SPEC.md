---
sidebar_position: 20
---

# UI/UX SPEC

**Version:** 1.0 (MVP Complete)
**Date:** 2025/12/22
**Project Philosophy:** "Ritual over Transaction" (事務処理ではなく、儀式的な体験を)

---

## 1. Global Design System

アプリケーション全体で統一すべきデザインルールです。

### 🎨 Color Palette
* **Background (Base):** `Slate-950` (#020617) - 漆黒の世界観。
* **Text (Primary):** `Slate-200` (#e2e8f0) - 読みやすさと没入感のバランス。
* **Accent (Gold):** `Yellow-500` (#eab308) - 高級感、招待状、特別なアクション。
* **Status Colors:**
  * `Green-500`: **Online / 即レス** (Pulse Animation)
  * `Yellow-500`: **Tonight / 今夜空き** (Pulse Animation)
  * `Purple-500`: **Asking / 要相談**
* **Danger:** `Red-500` - No Show、ブロック、警告。

### 🔠 Typography
* **Headings:** Serif (明朝体) - `font-family: "Yu Mincho", serif;`
  * 日本語の美しさと「和」の高級感を演出するために使用。
* **Body:** Sans-Serif (ゴシック体) - システムフォント
  * 可読性重視。数字は Monospace (`font-mono`) を使用して計器感を出す。

### 🎭 Motion & Interaction
* **One Screen Policy:** コア体験（チャット・予約）では画面遷移を行わず、**Drawer / Modal / Overlay** を使用する。
* **Framer Motion:** すべての動きは `Framer Motion` で実装し、物理的な質感（バネのような動き）を持たせる。
  * `AnimatePresence` を使用し、マウント/アンマウント時も滑らかに繋ぐ。

---

## 2. Screen Specifications: The Gate (Entry)

### 2-1. Login / LP
<!-- * **Reference:** `login_gate_demo.html` -->
* **Key Visual:**
  * 背景に「金の粒子 (Golden Particles)」がゆっくりと舞い上がるアニメーション。
* **Components:**
  * **Role Switcher:** 「Guest (Gentleman)」と「Cast (Goddess)」の切り替えタブ。
  * **Entrance Button:** 押下時、画面全体が奥へ吸い込まれるような Scale / Blur トランジションを実行。

---

## 3. Screen Specifications: User App (Gentleman Side)

### 3-1. Home (The Lobby)
<!-- * **Reference:** `user_phase1_5_demo.html` (View: Home) -->
* **Tabs:**
  * **Discover:** おすすめキャスト一覧。
  * **Following:** フォロー中キャストのステータス一覧。
    * **Priority Sort:** `Tonight` > `Online` > `Asking` > `Offline` の順にソート。
    * **Card Design:** `Tonight` のキャストは緑色のグロー効果 (`shadow-[0_0_15px]`) を付与。
* **Navigation:** Global Bottom Nav (Visible).

### 3-2. Cast Profile (The Portfolio)
<!-- * **Reference:** `profile_demo.html` / `user_phase1_5_demo.html` (View: Profile) -->
* **Hero Section:**
  * 画面上部50%を占める縦型ビジュアル（動画推奨）。下部はグラデーションで馴染ませる。
* **Indicators:**
  * **Promise Rate:** 大きく数値表示。
  * **Radar Chart:** ページロード時に5角形が広がるアニメーション (`grow-chart`)。
* **Action:**
  * **FAB (Fixed Footer):** 「招待状をリクエスト」ボタン。
  * **Follow Button:** ハートアイコン。押下時にバーストアニメーション (`scale: 1.3`).
* **Navigation:** Global Bottom Nav (Hidden).

### 3-3. Chat List (Talk)
<!-- * **Reference:** `user_chat_list_demo.html` -->
* **Visual Logic:**
  * **Invitation Glow:** `type: invitation` の未回答メッセージがあるチャットは、枠線が金色に明滅する (`border-glow` animation)。
  * **Status Ring:** アバターの周囲に現在のステータス色を表示。
* **Navigation:** Global Bottom Nav (Visible).

### 3-4. Chat Room & The Ritual
<!-- * **Reference:** `ui_reference.html` -->
* **Components:**
  * **Invitation Card:** キャストから送られたカード。
  * **Pledge Overlay:** カードタップで全画面展開。
* **Interaction (The Pledge):**
  * **Long Press:** 「予約する」ボタンを **1.5秒長押し** することで確定。
  * **Feedback:** プログレスリング進行 → 完了時にHaptic Feedback → 画面中央に「封蝋 (Sealed)」スタンプのアニメーション。

### 3-5. History & Review (The Archive)
<!-- * **Reference:** `user_history_demo.html` -->
* **List Item:**
  * `Upcoming` (予約済みチケット) と `History` (過去のチケット) のタブ切り替え。
* **Review Modal:**
  * `Visited` ステータスの予約に対してのみ起動可能。
  * **Radar Input:** 5段階のスライダーUIでパラメータ（Looks, Charm等）を入力させる。

---

## 4. Screen Specifications: Cast App (Goddess Side)

### 4-1. Onboarding Wizard
<!-- * **Reference:** `cast_phase1_5_demo.html` (Wizard Overlay) -->
* **Trigger:** 初回ログイン時 (`is_profile_completed: false`) に強制表示。
* **Steps:**
  1. **Identity:** 源氏名、アイコン。
  2. **Appeal:** メイン写真、タグ選択。
  3. **Concierge:** 招待状プランの初期設定 (90分コース等)。

### 4-2. Dashboard (Home)
<!-- * **Reference:** `cast_home_demo.html` -->
* **Header:**
  * **Status Toggler:** 自身のステータス (`Online`, `Tonight`...) を切り替えるドロップダウン。変更時にフォロワー通知トリガー。
* **Today's Promise:**
  * 本日の予約がある場合、最上部に大きく表示。
  * **CRM Snippet:** 顧客名の下に「顧客メモ（例: ワイン好き）」を表示し、事前準備を促す。
* **Chat List:**
  * 未読 > 招待状送付中 > 既読 の優先順位で表示。

### 4-3. Chat Room (Concierge)
<!-- * **Reference:** `chat_builder_demo.html` / `cast_phase1_5_demo.html` -->
* **Components:**
  * **Invitation Builder (Drawer):** 入力欄横のチケットアイコンから展開。日時・プランを選択してカードを送信。
  * **CRM Drawer (Slide-over):** ヘッダーの顧客名をタップして展開。非公開メモの閲覧・編集。
  * **No Show Alert (Inline):** `noshow_demo.html` 参照。予約時間経過後に出現。

### 4-4. My Page (Backstage)
<!-- * **Reference:** `cast_mypage_demo.html` -->
* **Stats:** 売上、フォロワー数、信頼スコアをダッシュボード化。
* **Menu:**
  * プロフィール編集（写真管理）。
  * フォロワーリスト。
  * プラン設定。

---

## 5. Navigation & Layout Rules

### Global Bottom Navigation
* **User App Items:** `Home`, `Talk` (Chat List), `History`
* **Cast App Items:** `Chats` (Dashboard), `Followers`, `MyPage`
* **Behavior:**
  * 第1階層（一覧画面）では **表示 (Sticky Bottom)**。
  * 第2階層（詳細画面、チャットルーム）では **非表示**。

### Modal & Drawer Strategy
* **Full Screen Modal:** 没入感が必要な場面（Wizard, Review, Pledge）。
* **Bottom Sheet (Half):** 作業効率重視（Invitation Builder）。
* **Slide-over (Side):** 文脈維持重視（CRM Memo）。

---

## 6. Implementation Notes for Developers

1.  **Tailwind Config:**
    * HTMLデモで使用している色は Tailwind のデフォルトパレット (`slate`, `yellow`, `green` 等) に準拠しているため、カスタム設定は最小限で済む。
2.  **Animation Library:**
    * デモ内の `@keyframes` は CSS で記述されているが、React 実装時は **`framer-motion`** への置き換えを推奨する。
    * 例: `modal-enter` クラス → `<motion.div initial={{ y: "100%" }} animate={{ y: 0 }} ... >`
3.  **Data Fetching:**
    * バックエンドとの連携時、チャットメッセージやステータス更新を即座にUIへ反映させること。
