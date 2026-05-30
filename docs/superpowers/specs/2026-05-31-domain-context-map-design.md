# Domain Context Map Design — full-stack rebuild keystone

Date: 2026-05-31
Status: Design spec (keystone; per-context detail deferred to slice specs)
Scope: 新コンセプト（風俗業界 SNS + カルテ）の境界づけられたコンテキストマップ、ubiquitous language、ロールモデル、機能/ルート inventory、縦スライス優先度。各 context のドメイン詳細・proto・実装は別スライス spec。
Related: `2026-05-29-design-system-design.md`（§1 product / §5 IA / §7 role / §8 カルテ）、`../2026-05-30-frontend-rebuild-roadmap.md`

## Overview

frontend だけでなく **proto 契約 + Ruby モノリス + frontend** を新ドメインに作り直す full-stack 再構築の keystone。本 spec は全派生物（proto パッケージ・モノリススライス・frontend module/IA）の源になる context マップを定義する。詳細設計は context 単位の縦スライスで行う。

## Decision context

- **製品** = 風俗業界全般の SNS。**feed が primary surface**。発見は feed・ランキング経由。
- **backend = フル進化**: proto + モノリスを新ドメインに作り直す（既存エスコート型ドメインの流用ではない）。
- **商取引次元を全ドロップ**: plans / schedules / offer / 出勤管理 / 予約 は新コンセプトに含めない。純 SNS + カルテ。
- **設計の進め方 = ハイブリッド**: 本 keystone（高レベル context マップ）→ 以降は context 単位の縦スライス（domain → proto → モノリス → frontend）。
- Phase 0（design token）と Phase 1a（コンポーネント語彙）は**ドメイン非依存**で本再構築でも有効。保留中の frontend データ層は新契約確定後に context スライスで作り直す。

## Ubiquitous language（命名）

エスコート時代のスライス名を新コンセプトの語彙に揃える。proto パッケージ・モノリススライス・frontend module 名に一貫適用する。

| 旧 | 新 | 理由 |
|---|---|---|
| portfolio | **profile** | SNS のプロフィール（エスコートのポートフォリオではない） |
| trust | **karte** | 製品の ubiquitous term（評価共有 = カルテ） |
| relationship | **social** | follow / block / 足跡 の社会グラフ |
| offer | （削除） | 商取引次元の撤去 |
| identity / post / feed / media | 据え置き | SNS で中立 |

**ロール名 cast / guest は据え置き**（製品語彙 キャスト/ゲスト、コード上 Cast/Guest）。これは context 名とは別レイヤーで、§7 / memory で確定済。

## Bounded contexts

### Keep / transform（既存スライス由来）

| Context | 責務 | 旧スライス |
|---|---|---|
| **identity** | 認証（SMS / JWT）・アカウント・ロール（cast/guest） | identity |
| **profile** | ユーザープロフィール（handle / 表示名 / avatar / bio / links / 店舗属性）。plans・schedules は剥がす。公開設定はプライバシー（follow 承認）として保持 | portfolio |
| **social** | follow（承認制）・block・足跡（プロフィール訪問） | relationship |
| **posts** | post / like / comment | post |
| **feed** | ホームタイムライン集約 | feed |
| **media** | アップロード・参照（pre-signed URL） | media |
| **karte** | review + tagging = 評価共有 SNS。**新コンセプトの中核**。法務ゲート | trust |

### New（現 backend に存在しない）

| Context | 責務 | 対応 nav |
|---|---|---|
| **messaging** | DM | メッセージ |
| **notifications** | 通知 | 通知 |
| **bookmarks** | 投稿の保存 | ブックマーク |
| **discovery** | 検索・ランキング・推し! | 検索 / ランキング / 推し! |

### Drop

- **offer**（plans / schedules）と booking / 出勤管理 次元を完全撤去。

## Role model（確定済）

- cast（従事者）/ guest（客）の 2 ロール。
- **店舗 = cast の属性**（ロールではない）。専用ロール/ダッシュボードは作らない。
- 単一デザイン言語。差分は nav 項目追加のみ。

## Feature / route inventory

spec §5 の nav を context へマップ。`<handle>` はユーザー識別子。

| route | 機能 | context |
|---|---|---|
| `/` | ホーム feed | feed |
| `/search` | 検索 | discovery |
| `/ranking` | ランキング | discovery |
| `/notifications` | 通知 | notifications |
| `/messages` | メッセージ | messaging |
| `/bookmarks` | ブックマーク | bookmarks |
| `/u/<handle>` | プロフィール | profile |
| `/posts/<id>` | 投稿詳細 | posts |
| `/settings` | 設定 | identity / profile |
| `/login`・`/register` | 認証 | identity |
| 足跡（cast） | プロフィール訪問履歴 | social |
| カルテ（cast） | 評価共有 | karte |

「推し!」「足跡」「カルテ」の route prefix は per-context スライスで確定。

## Vertical slice priority

1. **基盤**: identity → profile → media
2. **SNS 中核**: posts → feed → social
3. **周辺**: discovery → bookmarks → notifications → messaging
4. **karte**: 中核だが **弁護士確認が実装の前提**（§8 法務フラグ）。SNS 中核の後、法務クリア後に着手

各スライスは domain → proto → モノリス → frontend を縦に通し、独立に動作可能な単位とする。

## Karte legal gate

カルテ（評価共有）は個人情報保護法（要配慮個人情報＝性生活、開示請求権）・名誉毀損・風営法/売春防止法に触れる。**弁護士確認が実装の hard gate**（§8）。本 spec では context として位置づけるのみで、データスキーマ・同意設計・課金は karte スライス spec + 法務レビューで扱う。

## Open items（per-context スライスで解決）

- 足跡の置き場（social 内 vs 独立 context）
- follow 承認制（private cast）を残すか
- サービスカテゴリ（デリヘル / ソープ / 個人）を profile 属性 or discovery 次元のどちらに
- 「推し!」が follow と別概念か（支持 / お気に入り）
- 検索のスコープ（ユーザー / 投稿 / タグ）
- 各 context の集約・エンティティ詳細、proto パッケージ構成

## Relationship to existing code

- proto（`/proto/*`）・モノリス（`services/monolith/workspace` の 8 スライス）・frontend データ層は、本マップに沿って context 単位で作り直す。
- 既存の cast/guest ロール・media の pre-signed URL 方式など、新コンセプトでも妥当なパターンは踏襲してよい（命名は新語彙へ）。
- design system（token / component 語彙）は Phase 0 / 1a で確定済み・ドメイン非依存。
