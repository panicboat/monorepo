# rx-sns.jp Design Observations

Date: 2026-05-27 (Updated: 2026-05-28 — design tokens verified, 7 軸踏襲合意)
Status: Research notes (not a spec). デザインシステム spec の起点。
Target: <https://rx-sns.jp/> (Relaxi — メンズエステ専門 SNS)

## Purpose

frontend 刷新の参照先として rx-sns.jp を観察。design system / IA を抽象レベルで抽出し、本プロダクトの design system spec に持ち込める材料を整理する。具体的なコピー・画像・UGC は再現しない。

## How the Data Was Gathered

- rx-sns.jp は SPA。WebFetch / curl では HTML shell（4KB、`<title>` と meta のみ）しか取れない
- system Chrome を `--headless=new` で起動し、`--virtual-time-budget=8000ms` でレンダリング後に screenshot
- 認証後の画面は puppeteer-core で driving（`/tmp/rx-sns-puppet/`）。認証情報は環境変数経由
- 操作は read-only に限定（投稿・いいね・フォロー・他ユーザープロフィール訪問・`/messages`・`/notifications` は禁止）
- 撮影画像 19 枚は `/tmp/rx-sns-render/`（ephemeral）

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

  /* Typography */
  --font-sans: "Segoe UI", Meiryo, sans-serif;
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

## Decisions Agreed Today

本プロジェクトの設計判断。詳細は memory `project_redesign_2026_05.md` 参照。

1. **2 ロール構成 (ユーザー / セラピスト)**。rx-sns.jp は 3 ロール（+ 店舗オーナー）だが、本プロダクトでは店舗概念を意図的に持たない
2. **SNS feed primary** の構造を採用。発見は feed と /ranking 経由、検索・予約は補助
3. **単一デザイン言語 + 機能トグル**でロール差分を表現。色・レイアウト分岐は行わない
4. **Cast 間で Guest 評価共有 SNS が収益化の要**。rx-sns.jp に無い差別化要素
5. 今回 spec のスコープ = 両ロール分の design system / 世界観のみ。ページ個別の刷新は別 spec へ
6. **rx-sns.jp との境界線 (2026-05-28)**: 観察された 7 軸（カラー / タイポ / レイアウト / 左 nav 項目構成 / コンポーネント語彙 / 投稿カードパターン / ロール差分の表現）すべて踏襲。独自設計は Cast 間 Guest 評価共有 SNS の UI 位置づけのみ
7. **Design tokens 確定 (2026-05-28)**: 観察値の推測ではなく `:root` の CSS custom property と `getComputedStyle()` を直接抽出して確定。本ドキュメント "Color Tokens (Verified)" / "Typography (Verified)" / "Spacing / Radius (Verified)" / "Tailwind v4 Mapping" セクション参照

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
- Cast 間 Guest 評価共有 SNS の UI 位置づけ（既存 nav にどう挿入するか、新規 nav 項目か、Cast 専用タブか）
- 法務観点（個人情報保護・名誉毀損・利用規約）の design への反映ポイント
- 出勤管理 / 足跡 のように Cast 業務機能と SNS が同居する shell の中で、業務 vs SNS の視覚的区別をどう付けるか（あるいは付けないか）
- モバイル bottom tab bar の項目選定（Guest/Cast 共通でいいか）
- **Web font 採用方針**: rx-sns.jp は OS システムフォント任せ（Segoe UI + Meiryo + sans-serif）で OS ごとに見た目が変わる。本プロダクトでも踏襲か、Noto Sans JP 等の web font で揃えるか
- **Surface elevated 色の確定**: post card や elevated container の bg を `dark-900` で取るか別値か（rx-sns.jp の post card は実質 transparent + divider のみで判別困難）
- **Root font-size 15px 化のタイミング**: 採用は決定だが、既存全画面への影響大。design tokens spec 内では「採用」と書き、実移行は別フェーズ spec に切り出す

## Artifacts

- 撮影スクリーンショット: `/tmp/rx-sns-render/` (19 PNG, ephemeral)
- capture スクリプト: `/tmp/rx-sns-puppet/capture.js`
- 取得手順 / 操作制約: memory `reference_rx_sns_jp.md`
- 設計合意: memory `project_redesign_2026_05.md`
