# Design System Design — frontend 刷新

Date: 2026-05-29
Status: Design spec (implementation-ready)
Scope: 両ロール分の design system / 世界観。ページ個別の刷新・機能実装は別 spec。
Source: research notes `docs/research/2026-05-27-rx-sns-jp-design-observations.md`

## 1. Overview

### Product

風俗業界全般（デリヘル / ソープ / 個人活動）のための SNS プラットフォーム。SNS feed が primary surface。発見は feed と ランキング 経由、検索・予約は補助。

### Roles

- **キャスト**（従事者、コード上 Cast）— 個人活動を含む。所属店舗の有無は問わない
- **ゲスト**（客、コード上 Guest）
- **店舗はロールではなくキャストの所属先属性**。個人活動 = 所属なしキャスト

### Reference

design / IA は `https://rx-sns.jp/`（メンズエステ専門 SNS, Relaxi）を参照し踏襲。ドメインモデル・法務は本プロダクト独自。design token は rx-sns の実装値を `getComputedStyle` で抽出して採用（business 非依存のため流用可）。

### In scope

color / typography / spacing / radius / shadow tokens、layout system、navigation / IA、component vocabulary、role model、キャスト評価共有 SNS の placement（design-system 観点）。

### Out of scope（別 spec）

ページ個別の刷新、サービスカテゴリ（デリヘル/ソープ/個人）のドメインモデル、年齢確認/本人確認フロー、root font-size 15px 化の実移行、課金プラン詳細、評価共有のデータスキーマ。

## 2. Design Principles

1. **情報階層が最優先設計力** — 1 画面に主役は 1 つ。重要度をサイズ・配置・色で明示
2. **色数を絞る** — モノクロ neutral スケール + 単一ブランドグラデーションのみ
3. **規律あるスペーシング** — rem ベース（root 15px）の固定スケール
4. **ロール差分は機能トグルで表現** — 単一デザイン言語。色・レイアウト・コンポーネントはキャスト/ゲスト完全共通。差分は nav 項目の追加のみ

## 3. Design Tokens

実装は Tailwind v4 + `@theme inline`（現状の frontend スタックに準拠）。値は rx-sns 由来。

### 3.1 Color

色は hex で定義する。Tailwind v4 は opacity modifier（`bg-x/50` 等）を `color-mix()` で解決するため、v3 の `R G B` チャンネル形式は不要。`@theme` に bare channel（`248 250 252`）を入れると `bg-x` が `background-color: 248 250 252`（無効 CSS）になり描画されない。現行 frontend も hex token に alpha modifier を多用して動作しているため、その方式に揃える。

```css
@theme inline {
  /* Neutral scale */
  --color-neutral-50:  #f8fafc;
  --color-neutral-100: #f1f5f9;
  --color-neutral-200: #e2e8f0;
  --color-neutral-300: #cbd5e1;
  --color-neutral-400: #94a3b8;
  --color-neutral-500: #64748b;
  --color-neutral-600: #475569;
  --color-neutral-700: #334155;
  --color-neutral-800: #1e293b;
  --color-neutral-900: #0f172a;
  --color-neutral-950: #14161a;

  /* Brand */
  --color-brand-primary:   #a855f7;   /* purple */
  --color-brand-secondary: #ec4899;   /* pink */
  --color-brand-tertiary:  #f97316;   /* orange — 3-stop gradient 限定 */

  /* Functional */
  --color-input-bg:       #303030;
  --color-success-bg:     #166534;
  --color-success-text:   #4ade80;

  /* Semantic aliases */
  --color-bg:             var(--color-neutral-950);
  --color-surface:        var(--color-neutral-900);
  --color-divider:        var(--color-neutral-800);
  --color-border:         var(--color-neutral-700);
  --color-text-primary:   var(--color-neutral-50);
  --color-text-secondary: var(--color-neutral-400);
  --color-text-muted:     var(--color-neutral-500);
  --color-accent:         var(--color-brand-primary);
}
```

**Gradient utilities:**

- `--gradient-brand-2`: `linear-gradient(to right, var(--color-brand-primary), var(--color-brand-secondary))` — CTA 全般・フォロー・ブランドマーク
- `--gradient-brand-3`: `linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary), var(--color-brand-tertiary))` — 投稿 (compose) CTA 限定

**Brand glow shadow:** hex token は `rgb(var(--token) / α)` に展開できないため、既存 `--shadow-*` と同じく channel をハードコードする: `0 10px 15px -3px rgb(168 85 247 / 0.2), 0 4px 6px -4px rgb(168 85 247 / 0.2)`

**Semantic usage:**

| role | token |
|---|---|
| ページ背景 | `bg` (neutral-950) |
| カード / モーダル / 浮く面 | `surface` (neutral-900) |
| feed post | 塗りなし（transparent + `divider`） |
| interactive hover（nav item 等） | `neutral-800` 50% opacity |
| feed post hover | `neutral-900` 50% opacity |
| 入力 fill | `input-bg` |
| 入力 border（通常 / focus） | `border` / `accent` |
| リンク・active・focus ring | `accent` |
| error / warning / info | **未確定**（rx-sns 抽出画面に出現せず。spec 化時に補完） |

### 3.2 Typography

- **Font**: Noto Sans JP (variable)。`--font-sans: "Noto Sans JP", "Segoe UI", Meiryo, sans-serif;`
  - rx-sns は OS システムフォント任せだが、本プロダクトは OS 横断一貫のため web font を採用（唯一の意図的逸脱）
- **Root font-size**: 15px（`html { font-size: 93.75% }`）。1rem = 15px が全 token の前提
- **Scale**:
  - `--text-base`: 1rem (15px) / line-height 1.5 — 本文・nav label・CTA
  - `--text-sm`: 0.875rem (13.125px) / line-height 約 1.43 — タブ・補助情報・小リンク
- **Weights**: 400 / 500 / 700
- serif / display / italic は不使用

### 3.3 Spacing

Tailwind デフォルト spacing-N を root 15px で解決。

| N | rem | px |
|---|---|---|
| 1 | 0.25 | 3.75 |
| 2 | 0.5 | 7.5 |
| 3 | 0.75 | 11.25 |
| 4 | 1 | 15 |
| 5 | 1.25 | 18.75 |
| 6 | 1.5 | 22.5 |
| 8 | 2 | 30 |
| 12 | 3 | 45 |

### 3.4 Radius

| token | rem | 用途 |
|---|---|---|
| `--radius-sm` | 0.5 | 小ボタン（フォロー等） |
| `--radius-md` | 0.75 | 入力フィールド |
| `--radius-full` | 9999px | ピル CTA・アバター・nav hover area |
| (none) | 0 | post card（divider 区切りのみ） |

## 4. Layout System

### Desktop (≥1024px) — 3 カラム

```
┌─ 左 nav (≈240) ─┬── center (600-700) ──┬─ 右 panel (≈320) ─┐
│ logo            │  feed / page content  │ 検索 input        │
│ nav items       │                       │ おすすめユーザー   │
│ [投稿する CTA]   │                       │                   │
│ self avatar     │                       │                   │
└─────────────────┴───────────────────────┴───────────────────┘
```

### Mobile (<768px) — 二層 nav

- center 1 カラム。上部にロゴ中央 + アバター（左）
- **bottom tab bar（4 + FAB）**: ホーム / 検索 / 通知 / メッセージ + 投稿 FAB（右下、brand gradient 円）。Guest/Cast 同一
- **ドロワー（full nav）**: アバタータップで左スライドイン。プロフィール / 検索 / 通知 / 足跡(Cast) / メッセージ / ブックマーク / 推し！/ ランキング / 出勤管理(Cast) / カルテ(Cast) / 設定 + ログアウト
- 二層構造（bottom tab = 高頻度サブセット、drawer = full nav）は rx-sns 実機検証済

## 5. Navigation / IA

### 左 nav 項目

- **ゲスト**: ホーム / 検索 / 通知 / メッセージ / ブックマーク / 推し！/ ランキング / プロフィール / 設定
- **キャスト**: 上記 + 足跡 / 出勤管理 / **カルテ**（評価共有、本プロダクト独自）

### ロール差分

nav 項目の追加のみ。route prefix のロール分離はしない。shell・色・コンポーネントは共通。

### 主要ルート

`/`（feed）、`/login`・`/register`（認証）、`/search`・`/bookmarks`・`/ranking`・`/settings`、`/u/<handle>`（プロフィール、Cast は `/u/<handle>/shifts`）、`/posts/<id>`。

## 6. Component Vocabulary

### 既存 SNS shell のコンポーネント（踏襲）

- **CTA primary**: brand gradient pill、weight 700、brand glow shadow、`radius-full`
- **CTA secondary**: accent borderline pill
- **Input**: `input-bg` fill、`radius-md`、focus 時 `accent` border + ring
- **Tab**: 下線方式（active 下に gradient line）
- **Toggle switch**: 角丸ピル、on = accent
- **User card**（右 panel）: アバター丸 + 名前 + ハンドル + フォロー gradient pill
- **Post card**: アバター左 / 名前+ハンドル+時刻 / 本文 / 画像 grid（1-4 枚） / 反応行。container は transparent + `divider`
- **Avatar**: 丸、`radius-full`

### 追加が必要なコンポーネント（カルテ機能向け、既存 shell に無い）

- データテーブル / 高密度リスト
- フィルタ UI（タグ / 評価値 / 最終来店 / 未払い 等）
- レコード詳細フォーム
- **paywall ロック表示**（鍵アイコン + ぼかし + 課金 CTA）

これらも color / typography / spacing / radius token は本 spec に準拠。

## 7. Role Model

- **単一デザイン言語**。キャスト/ゲストで色・レイアウト・コンポーネント・タイポグラフィ完全共通
- 差分は nav 項目追加のみ（モバイルは drawer に出る）
- **店舗 = キャストの所属先属性**（ロールではない）。専用ダッシュボード/ロールは作らない

## 8. Feature: キャスト評価共有 SNS（placement）

本プロダクトの差別化要素・収益化の要。風俗業界での「客情報の従事者間共有 = 危険客情報共有 = 従事者安全」という実務に対応。design-system 観点での placement のみ本 spec の対象（データスキーマ・課金詳細は別 spec）。

- **機能モデル**: DB 型（ゲスト 1 人 = 1 構造化レコード）。透明性は **(b) 同意済み非常時開示型**（登録時規約同意で合法ルート、通常 UI でゲストに非表示）
- **キャスト側**: Cast nav に「カルテ」(仮称) を完全混在で追加。paywall ロック表示。主動線 = 予約/出勤連動（接客直後に記入）。一覧/検索 → レコード詳細 → 記入フォーム
- **ゲスト側**: 開示・訂正・削除請求は問い合わせ経由のみ（専用 UI 導線なし）。登録 wizard の規約同意に共有条項

### 法務フラグ（弁護士確認必須 — 実装前提）

- 個人情報保護法（開示請求権 第33条は設計で消せない、要配慮個人情報=性生活）、名誉毀損、風営法 / 売春防止法
- (b) で開示導線を UI に出さない選択は同意有効性を繊細にする → 最重要レビューポイント
- **キャスト側の年齢/本人確認**は自己申告では弱い（未成年登録は重大犯罪）。別途検討

## 9. Migration from Current Codebase

| 現状 | 本 spec での方針 |
|---|---|
| `src/app/(cast)/` + `(guest)/` ルートグループ分離 | 解消。共通 shell + 機能トグル |
| `--color-role-cast-*` / `--color-role-guest-*` の 2 系列 | 単一 neutral + brand に統合。role 別カラー廃止 |
| README と `theme.ts` の Cast/Guest 色定義の齟齬 | 単一 SoT 化で解消 |
| base font-size = browser default (16px) | 15px 化（移行タイミングは別 spec、影響大） |
| `config/theme.ts` の `colors.role.*` 参照 | 廃止対象 |
| modules 構成（feed / identity / media / portfolio / post / relationship / trust） | **本 spec の対象外**。どの module が必要かは新コンセプトの domain/feature spec で決定し、それを経て初めて不要な module が判明する。design system spec は module 構成に踏み込まない（各 module の現状は未調査） |

## 10. Open Questions / Deferred

- **法務**（弁護士確認必須）: 風営法 / 売春防止法 / 個人情報・名誉毀損・要配慮個人情報、(b) の同意有効性、キャスト年齢/本人確認
- error / warning / info の semantic color 未確定
- root font-size 15px 化の実移行タイミング（既存全画面に影響）
- サービスカテゴリ（デリヘル/ソープ/個人）のドメインモデル — 本 spec では「カテゴリ軸が存在する」前提のみ、詳細は別 spec
- カルテ画面の情報密度と SNS 余白基調の両立、客観事実 vs 主観評価のフィールド分離、課金プラン粒度

## 11. Artifacts

- 観察 notes: `docs/research/2026-05-27-rx-sns-jp-design-observations.md`
- キャプチャ + token JSON + スクリプト: `.superpowers/rx-sns-render/`（gitignore 済）
- memory: `project-redesign-2026-05`, `reference-rx-sns-jp`
