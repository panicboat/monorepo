# rx-sns.jp Design Observations

Date: 2026-05-27
Status: Research notes (not a spec). 次回のデザインシステム spec 起点。
Target: <https://rx-sns.jp/> (Relaxi — メンズエステ専門 SNS)

## Purpose

frontend 刷新の参照先として rx-sns.jp を観察。design system / IA を抽象レベルで抽出し、本プロダクトの design system spec に持ち込める材料を整理する。具体的なコピー・画像・UGC は再現しない。

## How the Data Was Gathered

- rx-sns.jp は SPA。WebFetch / curl では HTML shell（4KB、`<title>` と meta のみ）しか取れない
- system Chrome を `--headless=new` で起動し、`--virtual-time-budget=8000ms` でレンダリング後に screenshot
- 認証後の画面は puppeteer-core で driving（`/tmp/rx-sns-puppet/`）。認証情報は環境変数経由
- 操作は read-only に限定（投稿・いいね・フォロー・他ユーザープロフィール訪問・`/messages`・`/notifications` は禁止）
- 撮影画像 19 枚は `/tmp/rx-sns-render/`（ephemeral）

## Color Palette (Estimated)

ダーク基調 + 単一のピンク→パープルグラデーション、という一貫した設計。色数は徹底的に絞られている。

| 役割 | 推定値 | 用途 |
|---|---|---|
| Background base | `#0a0a0c` 系 (near-black, わずかにブルーグレー寄り) | 全画面の地 |
| Surface elevated | `#1a1a20` 系 | カード、入力フィールド |
| Border subtle | `#2a2a35` 系 | ディバイダー、カード境界 |
| Text primary | `#ffffff` | 本文 |
| Text muted | `#9aa0a8` 系 | プレースホルダー、メタ |
| Brand gradient | `#FF4D88` → `#A855F7` (ピンク→パープル) | CTA ピル、ロゴ、ブランドマーク |
| Accent solid | `#A855F7` 系 | フォーカスリング、リンク、active 状態 |
| Toggle on | パープル単色 | 設定 switch |
| Calendar day color | 土=青、日=赤 | 出勤管理カレンダー（日本式） |

**判断:** モノクロ + ブランドグラデ 1 種のみで全画面を成立させている。「色数を絞る」原則の徹底。

## Typography

- Sans-serif 1 種（Noto Sans JP 系と推定）
- Weight 400 (本文) / 700 (見出し・CTA)
- Serif / display 系は未使用
- 行間広め、letter-spacing は default 付近
- 言語別の混植や font fallback の作り込みは目立たない

## Spacing / Radius

- Border radius: 入力 ≈ 10px / カード ≈ 12-16px / ピル = fully rounded (999px)
- CTA: pill 型 + ふっくらしたグロー感（gradient の発光）
- 入力フィールド: 角丸 + dark fill + focus 時パープル枠
- カード境界: 影なし、極薄ボーダー or surface 色差のみ（フラット寄り）

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

- design tokens の具体値（hex / scale）の確定 — observed 値は推定であり、検証が必要
- rx-sns.jp の何を「同じ」にし、何を「違える」か、項目別の境界線
- Cast 間 Guest 評価共有 SNS の UI 位置づけ（既存 nav にどう挿入するか、新規 nav 項目か、Cast 専用タブか）
- 法務観点（個人情報保護・名誉毀損・利用規約）の design への反映ポイント
- 出勤管理 / 足跡 のように Cast 業務機能と SNS が同居する shell の中で、業務 vs SNS の視覚的区別をどう付けるか（あるいは付けないか）
- モバイル bottom tab bar の項目選定（Guest/Cast 共通でいいか）

## Artifacts

- 撮影スクリーンショット: `/tmp/rx-sns-render/` (19 PNG, ephemeral)
- capture スクリプト: `/tmp/rx-sns-puppet/capture.js`
- 取得手順 / 操作制約: memory `reference_rx_sns_jp.md`
- 設計合意: memory `project_redesign_2026_05.md`
