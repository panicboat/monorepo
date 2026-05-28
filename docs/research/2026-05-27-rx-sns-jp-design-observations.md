# rx-sns.jp Design Observations

Date: 2026-05-27 (Updated: 2026-05-29 — design tokens verified, 7 軸踏襲合意, Cast 評価共有 SNS placement 確定, 製品コンセプトを風俗全般に修正)
Status: Research notes (not a spec). デザインシステム spec の起点。
Reference target: <https://rx-sns.jp/> (Relaxi — メンズエステ専門 SNS)

## Purpose

frontend 刷新の **design / IA 参照先** として rx-sns.jp を観察。design system / IA を抽象レベルで抽出し、本プロダクトの design system spec に持ち込める材料を整理する。具体的なコピー・画像・UGC は再現しない。

## Product Concept（本プロダクト — Updated 2026-05-29）

- **対象**: 風俗業界全般（**デリヘル / ソープ / 個人活動** など）。当初は「メンズエステ専門」で進めていたが 2026-05-29 にコンセプト拡大
- **rx-sns.jp との関係**: rx-sns.jp はメンズエステ専門 SNS。**design / IA の参照先としては有効**だが、ドメインモデル（業態カテゴリ・店舗の扱い・法務）は別物。本ドキュメントの「観察」部分は rx-sns についての事実、「決定」部分は本プロダクトの方針
- **ロール**: キャスト（従事者、個人活動含む）/ ゲスト（客）の 2 ロール。**店舗はロールではなくキャストの所属先属性**。個人活動 = 所属なしキャスト。用語は キャスト/ゲスト（rx-sns 固有語「セラピスト」は使わない）
- **法務**: 風営法 / 売春防止法 / 個人情報保護法 / 名誉毀損 / 年齢確認 が関わり、弁護士確認の重要度が高い（後述 placement / Open Questions）

## How the Data Was Gathered

- rx-sns.jp は SPA。WebFetch / curl では HTML shell（4KB、`<title>` と meta のみ）しか取れない
- system Chrome を `--headless=new` で起動し、`--virtual-time-budget=8000ms` でレンダリング後に screenshot
- 認証後の画面は puppeteer-core で driving（`/tmp/rx-sns-puppet/`）。認証情報は環境変数経由
- 操作は read-only に限定（投稿・いいね・フォロー・他ユーザープロフィール訪問・`/messages`・`/notifications` は禁止）
- 撮影画像 24 枚は `.superpowers/rx-sns-render/`（gitignore 済で永続化。/tmp から移動）。design token は getComputedStyle で直接抽出（後述）

## Color Tokens (Verified — 2026-05-28)

抽出方法: 認証付き puppeteer で `:root` の CSS custom property と主要要素の `getComputedStyle()` を直接吸い出した（`/tmp/rx-sns-puppet/extract-tokens.js`、出力 `/tmp/rx-sns-render/tokens.json`）。rx-sns.jp は Tailwind v3 ベースで、Slate 系 HSL の 11 段スケール + ブランド 3 色 + functional + success セマンティックという構成。

### Neutral Scale

| Token | rgb | Hex |
|---|---|---|
| `dark-50`  | 248 250 252 | `#F8FAFC` |
| `dark-100` | 241 245 249 | `#F1F5F9` |
| `dark-200` | 226 232 240 | `#E2E8F0` |
| `dark-300` | 203 213 225 | `#CBD5E1` |
| `dark-400` | 148 163 184 | `#94A3B8` |
| `dark-500` | 100 116 139 | `#64748B` |
| `dark-600` |  71  85 105 | `#475569` |
| `dark-700` |  51  65  85 | `#334155` |
| `dark-800` |  30  41  59 | `#1E293B` |
| `dark-900` |  15  23  42 | `#0F172A` |
| `dark-950` |  20  22  26 | `#14161A` |

`dark-50` 〜 `dark-900` は Tailwind の Slate スケールそのまま。`dark-950` だけ独立値（純粋な near-black）で body background 専用。

### Brand

| Token | rgb | Hex | 用途 |
|---|---|---|---|
| `primary` (purple) | 168 85 247 | `#A855F7` | focus, link, accent solid, gradient 始点 |
| `secondary` (pink) | 236 72 153 | `#EC4899` | gradient 中継 |
| `tertiary` (orange) | 249 115 22 | `#F97316` | compose CTA「投稿する」の 3 色 gradient 終点でのみ使用 |

**Gradient:**
- 2-stop（login / follow / おすすめ CTA など多数）: `linear-gradient(to right, primary, secondary)`
- 3-stop（compose CTA のみ）: `linear-gradient(135deg, primary, secondary, tertiary)`

**Glow shadow（CTA 共通）:** `rgba(168, 85, 247, 0.2) 0px 10px 15px -3px, rgba(168, 85, 247, 0.2) 0px 4px 6px -4px` （Tailwind 表記: `shadow-lg shadow-primary-500/20`）

### Functional

| Token | 値 | 用途 |
|---|---|---|
| `input-bg` | `rgb(48, 48, 48)` | 入力フィールド fill。**dark スケールから外れた独立値** |
| `scrollbar-thumb` | `#334155` (= dark-700) | スクロールバー |
| `scrollbar-thumb-hover` | `#475569` (= dark-600) | hover |
| `success-bg` | `rgb(22, 101, 52)` | 成功バナー bg |
| `success-border` | `rgb(22, 101, 52)` | 成功バナー border |
| `success-text` | `rgb(74, 222, 128)` | 成功テキスト |

※ error / warning / info の semantic は今回抽出した画面には出現せず未確認

### Semantic Mapping（本プロダクトでの用例）

| Semantic role | Token |
|---|---|
| Page background | `dark-950` |
| Card / surface elevated | （未確定、`dark-900` 採用候補） |
| Hover surface | `dark-900/50` (50% opacity) |
| Divider | `dark-800` |
| Text primary | `dark-50` |
| Text secondary / muted | `dark-400` 〜 `dark-500` |
| Input fill | `input-bg` |
| Input border default | `dark-700` |
| Input border focus | `primary` |
| Link / accent | `primary` |
| Active nav highlight bg | `dark-800/50` |

## Typography (Verified — 2026-05-28)

- **Font family**: `"Segoe UI", Meiryo, sans-serif`
  - **意外な点**: 2026-05-27 時点で「Noto Sans JP 系と推定」と書いていたが誤り。実際は **web font 無し、OS システムフォント任せ**。Windows: Segoe UI + Meiryo、macOS/iOS: System UI フォールバック、Android: Roboto + Droid Sans Fallback。OS ごとに見た目が変わる
  - **採用判断 (2026-05-29)**: 本プロダクトは **Noto Sans JP (variable)** を採用し OS 横断で字面を統一。rx-sns の system font 任せとはここだけ意図的に異なる
- **Base font-size**: `15px`（HTML root を 93.75% 相当に縮めて 1rem = 15px が前提）
- **Line-height**: `1.5`（= 22.5px @ 15px base）
- **Observed sizes**:
  - `15px` / line-height `22.5px` — 本文、nav label、CTA
  - `13.125px` (= 0.875rem) / line-height `18.75px` — タブラベル、補助情報、小リンク、検索 placeholder
- **Weights**: 400 / 500 / 700
- Letter-spacing: normal
- Serif / display / italic は未使用

## Spacing / Radius (Verified — 2026-05-28)

### Spacing scale

Tailwind v3 デフォルトの spacing-N を、root `font-size: 15px` で rem 解決した結果：

| Tailwind N | rem | px @ 15px base |
|---|---|---|
| 1 | 0.25rem | 3.75px |
| 2 | 0.5rem | 7.5px |
| 3 | 0.75rem | 11.25px |
| 4 | 1rem | 15px |
| 5 | 1.25rem | 18.75px |
| 6 | 1.5rem | 22.5px |
| 8 | 2rem | 30px |
| 12 | 3rem | 45px |

**観察された主要パディング/サイズ:**
- 左 nav item: padding `11.25px 15px`、高さ `52.5px`、幅 `216.5px`、`mb-2` = `7.5px`
- 入力フィールド: padding `11.25px 15px`、高さ `47px`、幅 `360px`
- CTA primary（ログイン）: padding `11.25px 22.5px`、高さ `45px`、幅 `180px`
- Compose CTA: padding `11.25px 15px`、高さ `45px`
- Follow button: padding `5.625px 11.25px`、高さ `30px`
- Avatar: `37.5px` 正方
- Post card: padding `11.25px 15px`、高さ `132.5px`、幅 `~628px`

### Radius scale

| 名称 | 値 | 用途 |
|---|---|---|
| `rounded-md` | `7.5px` (= 0.5rem) | 小ボタン（follow など） |
| `rounded-xl` | `11.25px` (= 0.75rem) | 入力フィールド |
| `rounded-full` | `9999px` | ピル CTA、アバター、nav item の hover area |
| なし | `0px` | post card（divider 区切りのみ、container 角丸なし） |

### Shadow / Glow

CTA 共通の発光 shadow:
`rgba(primary, 0.2) 0px 10px 15px -3px, rgba(primary, 0.2) 0px 4px 6px -4px`
（Tailwind 表記では `shadow-lg shadow-primary-500/20`）

## Tailwind v4 Mapping (採用方針 — 2026-05-28)

rx-sns.jp は Tailwind v3。本プロダクトは Tailwind v4 + `@theme inline`。値は踏襲、token 構造は v4 のセマンティック命名に整理する。

```css
@theme inline {
  /* Neutral scale (rx-sns 踏襲) */
  --color-neutral-50:  248 250 252;
  --color-neutral-100: 241 245 249;
  --color-neutral-200: 226 232 240;
  --color-neutral-300: 203 213 225;
  --color-neutral-400: 148 163 184;
  --color-neutral-500: 100 116 139;
  --color-neutral-600: 71 85 105;
  --color-neutral-700: 51 65 85;
  --color-neutral-800: 30 41 59;
  --color-neutral-900: 15 23 42;
  --color-neutral-950: 20 22 26;

  /* Brand (rx-sns 踏襲) */
  --color-brand-primary:   168 85 247;   /* purple */
  --color-brand-secondary: 236 72 153;   /* pink */
  --color-brand-tertiary:  249 115 22;   /* orange — compose CTA limited */

  /* Functional */
  --color-input-bg: 48 48 48;

  /* Semantic */
  --color-bg:             var(--color-neutral-950);
  --color-surface:        var(--color-neutral-900);
  --color-divider:        var(--color-neutral-800);
  --color-text-primary:   var(--color-neutral-50);
  --color-text-secondary: var(--color-neutral-400);
  --color-text-muted:     var(--color-neutral-500);
  --color-border:         var(--color-neutral-700);
  --color-accent:         var(--color-brand-primary);

  /* Typography — Noto Sans JP (variable) 採用 (2026-05-29)。rx-sns は system font だがここは独自判断で OS 横断一貫を優先 */
  --font-sans: "Noto Sans JP", "Segoe UI", Meiryo, sans-serif;
  --text-sm:   0.875rem;
  --text-base: 1rem;

  /* Radius */
  --radius-sm:   0.5rem;
  --radius-md:   0.75rem;
  --radius-full: 9999px;
}

/* root font-size を 15px に揃える（rx-sns 互換） */
html { font-size: 93.75%; }
```

### 現状コードとの差分（実装時に解消すべきもの）

- 現状 `--color-brand-primary` / `--color-role-cast-*` / `--color-role-guest-*` の 3 系列 → 1 系列に統合
- 現状の `colors.role.cast.default` / `colors.role.guest.default` 参照は廃止対象
- 現状 base font-size は browser default (16px) のはず → 15px ベースに変更すると既存全画面に影響。**font-size 統一は別 spec に切り出す候補**（design tokens spec 内では「採用」、移行は別フェーズ）

## Layout

### デスクトップ (≥1024px)

3 カラム構成：

```
┌─ 240px ─┬──── 600-700px ────┬─ 320px ─┐
│ logo    │  (main content)   │ search  │
│ nav     │  timeline /       │         │
│ items   │  profile / etc    │ おすすめ │
│         │                   │ ユーザー │
│ [post]  │                   │ list    │
│ self    │                   │         │
└─────────┴───────────────────┴─────────┘
```

- 左 nav: icon (outline) + label, 縦並び
- 左下に「投稿する」CTA（pink-purple gradient pill）、その下に自分のアバター + ハンドル
- 右パネル: 検索 input 上部固定、下に「おすすめユーザー」リスト
- 中央: ページごとに変わる main content

### モバイル (<768px)

- 中央 1 カラム
- 上部: ロゴ中央 + アバター右
- **下部 bottom tab bar**（4 アイコン: ホーム / 検索 / 通知 / メッセージ）
- 右下に **FAB**（pink gradient 円 + アイコン）= 投稿 CTA
- top にコンパクトな promo バナー（未ログイン時の登録促進など）
- **採用判断 (2026-05-29)**: 共通 4 tab + FAB を踏襲。Cast の追加機能（足跡/出勤管理/カルテ）は bottom tab に入れず**ドロワー（full nav）に逃がす** — これは rx-sns の実装そのもの（実機検証済、"モバイルのナビ二層構造" 参照）。bottom tab は Guest/Cast 同一（検証済）

## Navigation / IA

### Guest (ユーザー) 左 nav — 9 項目

1. ホーム
2. 検索
3. 通知
4. メッセージ
5. ブックマーク
6. 推し！
7. ランキング
8. プロフィール
9. 設定

### Cast (セラピスト) 左 nav — 11 項目

Guest と同じ 9 項目 + 以下 2 項目を追加：

- **足跡** (visitor trail — 通知の下に挿入)
- **出勤管理** (shift management — ランキングとプロフィールの間)

### モバイルのナビ二層構造 (Verified — 2026-05-29)

モバイルでは nav が 2 層に分かれる（Cast でアバタータップして実機確認済）:

- **bottom tab（4 + FAB）**: ホーム / 検索 / 通知 / メッセージ + 投稿 FAB。高頻度項目のみ。Guest/Cast 同一
- **ドロワー（full nav）**: 上部アバタータップで左スライドイン。プロフィール / 検索 / 通知 / 足跡 / メッセージ / ブックマーク / 推し！/ ランキング / 出勤管理 / 設定 + 最下部にログアウト。**Cast 固有項目（足跡・出勤管理）はここに入る**

→ bottom tab は drawer の高頻度サブセット、drawer が full nav という二層構造。「ロール差分をドロワーに逃がす」はこちらの発明ではなく **rx-sns の実装そのもの**。踏襲で確定。

### 重要な観察：ロール差分は「nav 項目追加のみ」

- 色・レイアウト・コンポーネント・タイポグラフィは Cast/Guest で完全に同一
- shell も同一、route prefix もロール別に分かれていない
- 「単一デザイン言語 + 機能トグル」が実装されているパターン

### ルーティング観察

- `/` = タイムライン (両ロール、ログイン状態に応じて表示変化)
- `/login`, `/register` = 認証導線
- `/search`, `/bookmarks`, `/ranking`, `/settings` = SNS 標準
- `/u/<handle>` = ユーザープロフィール（Cast の場合は `/u/<handle>/shifts` で出勤管理）
- `/posts/<uuid>` = 個別投稿
- 未知パス `/<word>` は基本 `/u/<word>` 相当の挙動（user-not-found 表示）→ SPA の catch-all 性質

## Component Vocabulary (Observed)

- **Input**: dark surface fill + 角丸 + focus 時パープル枠 + 右端アイコン（パスワード可視化など）
- **CTA primary**: pink-purple gradient pill, グロー感
- **CTA secondary**: パープル borderline ピル
- **Tab**: 下線方式（active 下に gradient line）
- **Toggle switch**: 角丸ピル、on = パープル
- **ユーザーカード**（おすすめパネル）: アバター丸 + 表示名 + ハンドル + フォロー gradient pill ボタン
- **タイムライン投稿**: アバター左 / 名前+ハンドル+時刻 / 本文 / 画像 grid（1-4 枚で Twitter 配置） / 反応行（reply, repost, like, bookmark, share）
- **設定タブ**: 通知設定 / エリア / 外観 / プライバシー / アカウント の 5 タブ。通知は粒度細かく switch 並列

## Registration Flow (Observed)

- `/register` (or `/login` の「新規登録」リンク) で wizard 開始
- Step 1: アカウント種別選択（3 ロール: ユーザー / セラピスト / 店舗オーナー）
- 3 segment の progress indicator あり
- 各種別カード = アイコン + 種別名 + 説明文 + 選択 active 時パープル枠
- Step 2+ は安全制約のため未取得（次へクリックで確認メール等送信される可能性あり）

## キャスト評価共有 SNS — Placement Design (2026-05-29)

本プロダクトの差別化要素（収益化の要）。rx-sns.jp に参照パターン無しの独自設計。風俗業界での「客情報の従事者間共有」は **危険客情報の共有 = 従事者安全**という確立した実務であり、機能の社会的正当性はこの観点で支えられる。

### 機能モデル

- **形式**: DB 型（ゲスト 1 人 = 1 構造化レコード。客観事実 + 評価 + キャスト記入履歴）
- **透明性**: (b) 同意済み非常時開示型。登録時の規約同意で「評価情報が事業者・キャスト間で共有される」ことに同意取得 → 合法ルートに乗せる。通常 UI ではゲストに評価を一切表示しない
- **収益化**: キャストの有料機能

### 法務前提（弁護士確認必須 — 最重要）

風俗全般を対象にすることで法務の重要度が一段上昇。設計確定前に個人情報保護/IT/風営法に強い弁護士のレビュー必須。

- **個人情報保護法**: 評価共有 DB は個人情報データベース。開示請求権（第33条）は設計で消せない。要配慮個人情報（**性生活に該当しうる**）が混入すると取得に明示同意が必要
- **名誉毀損**: 客評価の従事者間共有は公然性が残る。「客観事実」と「主観評価」のフィールド分離でリスク低減
- **風営法 / 売春防止法**: 特にソープ・個人活動はグレー領域に触れうる。プラットフォームの立て付けに影響
- **(b) の同意有効性**: 「同意取得型」で合法ルートを取るが、**開示請求導線を UI に出さず問い合わせ経由のみとする選択（L3-4）は、「同意はしたが導線が無い」状態として同意有効性をさらに繊細にする**。弁護士レビューの最重要ポイント。問い合わせ経由でも実際の開示・訂正・削除には必ず対応する運用が前提
- **年齢確認**: ゲスト側は rx-sns 同等の利用規約ベース自己申告で進める。ただし**キャスト側（従事者）の年齢/本人確認は別問題** — 未成年を風俗系に登録させると重大犯罪（児童福祉法等）に直結するため自己申告では弱く、従事者オンボーディングの年齢/本人確認は弁護士確認推奨（本 spec では flag に留め、別途検討）

### Cast 側（主機能・課金対象）

- **nav 項目「カルテ」**（仮称、調整可）を Cast nav に追加
  - 「来店履歴」も候補だが、案2 は評価を含むため「カルテ」（施術記録 + 所見）の方が内容に対し誠実かつ optics 良
- **配置**: 完全混在（A、軸7 踏襲）。出勤管理 / 足跡 と同じ並びにフラットに置く。業務モード切替やセクション区切りはしない
- **paywall**: ロック表示（無料 Cast にも項目を見せ、鍵アイコン + タップで課金導線）。upsell 認知を優先
- **内部構造**:
  - 主動線 = **予約 / 出勤連動**。当日の来店予定から該当 Guest を開いて記入（記入 motivation が接客直後に最大）
  - 検索 / 一覧ビュー（フィルタ: タグ / 評価値 / 最終来店 / 未払い有無 等）
  - Guest レコード詳細（客観事実 + 評価 + 他 Cast 記入履歴）
  - 評価記入フォーム

### Guest 側（コンプライアンス・最小露出）

- 開示・訂正・削除請求は **問い合わせ経由のみ**（L3-4）。専用 UI 導線は置かない
- 通常 UI に評価を一切出さない
- 登録 wizard の規約同意に共有条項を含める

### design system との関係

- 色・タイポ・radius は完全踏襲（カルテ画面も dark + brand トークン）
- **追補が必要なコンポーネント**（既存 SNS shell に無い）: テーブル / フィルタ / 高密度リスト / レコード詳細フォーム / paywall ロック表示（鍵 + ぼかし + 課金 CTA）

### 残課題

- カルテ画面の情報密度と、既存 SNS の余白基調との両立（業務 SaaS 的密度を dark トークンで成立させる）
- 「客観事実」と「主観評価」のフィールド分離方針（名誉毀損リスク低減に有効）
- 課金プランの粒度（カルテ単体課金か、Cast 向けプレミアム一括か）

## Decisions Agreed Today

本プロジェクトの設計判断。詳細は memory `project_redesign_2026_05.md` 参照。

1. **対象 = 風俗全般（デリヘル/ソープ/個人活動）、2 ロール構成 (ゲスト / キャスト)** (2026-05-29 修正)。rx-sns.jp は 3 ロール（+ 店舗オーナー）だが、**店舗はロールでなくキャストの所属先属性**として 2 ロール維持。個人活動 = 所属なしキャスト。用語は キャスト/ゲスト
2. **SNS feed primary** の構造を採用。発見は feed と /ranking 経由、検索・予約は補助
3. **単一デザイン言語 + 機能トグル**でロール差分を表現。色・レイアウト分岐は行わない
4. **Cast 間で Guest 評価共有 SNS が収益化の要**。rx-sns.jp に無い差別化要素
5. 今回 spec のスコープ = 両ロール分の design system / 世界観のみ。ページ個別の刷新は別 spec へ
6. **rx-sns.jp との境界線 (2026-05-28)**: 観察された 7 軸（カラー / タイポ / レイアウト / 左 nav 項目構成 / コンポーネント語彙 / 投稿カードパターン / ロール差分の表現）すべて踏襲。独自設計は Cast 間 Guest 評価共有 SNS の UI 位置づけのみ
7. **Design tokens 確定 (2026-05-28)**: 観察値の推測ではなく `:root` の CSS custom property と `getComputedStyle()` を直接抽出して確定。本ドキュメント "Color Tokens (Verified)" / "Typography (Verified)" / "Spacing / Radius (Verified)" / "Tailwind v4 Mapping" セクション参照
8. **Cast 評価共有 SNS の placement (2026-05-29)**: DB 型 + (b) 同意済み非常時開示型。Cast nav に「カルテ」(仮) を完全混在で追加、paywall はロック表示、主動線は予約/出勤連動。Guest 側開示は問い合わせ経由のみ（UI 導線なし）。法的有効性（特に開示導線の非設置）は弁護士確認必須。詳細は "Cast 評価共有 SNS — Placement Design" セクション参照
9. **Design system 細部確定 (2026-05-29)**: Web font = Noto Sans JP (variable) 採用（rx-sns の system font からこの点のみ意図的逸脱）。Surface elevated = `dark-900`（feed post は transparent + divider 踏襲）。モバイル bottom tab = 共通 4 + FAB 踏襲、ロール差分はドロワー

## Implications for Current Codebase

次回 spec / 実装で考慮すべき差分。

| 現状 | 観察された方向 |
|---|---|
| `src/app/(cast)/` + `src/app/(guest)/` ルートグループ分離 | ルートグループ分離は不要。共通 shell + 機能トグルで実現 |
| `role.cast` (pink) / `role.guest` (blue) の 2 系列カラートークン | 単一ブランドグラデ + accent solid に統合 |
| README と `theme.ts` で Cast/Guest の色定義が逆 | 単一 SoT を作る方向で統合（差分そのものが消える） |
| modules: feed / identity / media / portfolio / post / relationship / trust | rx-sns.jp の IA に近いが、`portfolio` 等の旧コンセプト名残は別 spec で見直し対象 |
| 認証後の主導線が暗黙 | feed primary, sidebar IA を明文化する |

## Open Questions (次回 spec 時に決めるべきこと)

- ~~design tokens の具体値（hex / scale）の確定~~ → 解決済 (2026-05-28)
- ~~rx-sns.jp の何を「同じ」にし、何を「違える」か、項目別の境界線~~ → 解決済 (2026-05-28、7 軸全踏襲)
- ~~Cast 間 Guest 評価共有 SNS の UI 位置づけ~~ → 解決済 (2026-05-29、"Cast 評価共有 SNS — Placement Design" 参照)
- ~~業務 vs SNS の視覚的区別~~ → 解決済 (2026-05-29、完全混在 A 採用)
- **法務観点（弁護士確認必須）**: 風営法 / 売春防止法 / 個人情報保護・名誉毀損・要配慮個人情報（性生活）。特に (b) で開示導線を UI に出さない選択の同意有効性、および**キャスト側の年齢/本人確認**（自己申告では弱い）。design 確定前に弁護士レビュー
- ~~モバイル bottom tab bar の項目選定~~ → 解決済 (2026-05-29、共通 4 + ドロワー)
- カルテ画面の情報密度と SNS 余白基調の両立、客観事実 vs 主観評価のフィールド分離、課金プラン粒度（placement セクションの残課題）
- ~~Web font 採用方針~~ → 解決済 (2026-05-29、Noto Sans JP variable 採用)
- ~~Surface elevated 色の確定~~ → 解決済 (2026-05-29、`dark-900`。feed post は transparent + divider 踏襲)
- **Root font-size 15px 化のタイミング**: 採用は決定だが、既存全画面への影響大。design tokens spec 内では「採用」と書き、実移行は別フェーズ spec に切り出す

## Artifacts

- 撮影スクリーンショット + tokens.json + capture スクリプト: `.superpowers/rx-sns-render/`（gitignore 済で永続化。24 PNG。/tmp から移動）
- capture スクリプト: `.superpowers/rx-sns-render/{explore,capture,extract-tokens,mobile-drawer}.js`（実行には puppeteer-core が必要、`/tmp/rx-sns-puppet/node_modules` に依存。再 install 可）
- 取得手順 / 操作制約: memory `reference_rx_sns_jp.md`
- 設計合意: memory `project_redesign_2026_05.md`
