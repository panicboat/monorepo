# Profile Slice Design — full-stack vertical slice

Date: 2026-06-02
Status: Design spec (implementation-ready)
Scope: profile context（ユーザープロフィール）を domain → proto → monolith → frontend の縦スライスで再構築。旧 `portfolio` スライスを `profile` に改名し、エスコート商取引次元を撤去、rx-sns 準拠のフィールドへ整理。
Related: `2026-05-31-domain-context-map-design.md`（keystone、profile = 2番目の縦スライス）、`2026-05-31-identity-slice-design.md`（Account / role）

## Grounding（重要）

本 spec のフィールドセットは **rx-sns.jp（参照プロダクト）の実物**に準拠する。観察方法:
- 認証付き headless capture で自分の profile・設定（エリア階層）を取得（`.superpowers/rx-sns-render/`、gitignore 済）。
- **プロフィール編集フォーム**はユーザー提供のスクリーンショットで確定（自動化では開けなかった）。

推測で決めず、上記実物に揃える。当初「物理属性 drop / category defer」としていた判断は rx-sns 実物（年齢/身長/カップサイズ/業種が存在）に基づき**撤回**。

## Goal

旧 portfolio（cast=リッチ / guest=最小の分離型、商取引前提）を、**統合 Profile**（共通 + cast extras）に再構築し、rx-sns 準拠のフィールドに整理。username を全ユーザーへ導入。

## Ubiquitous language

| 旧 | 新 |
|---|---|
| portfolio（スライス） | **profile** |
| slug（cast の URL キー） | **username**（全ユーザーの @ハンドル） |

## Domain model — Unified Profile

全ユーザーが 1 つの `Profile`（PK = account id、identity の Account と 1:1）。role 別の差分は optional な cast extras で表現（単一デザイン言語）。

### 共通フィールド（全ユーザー）

| フィールド | 型 | 備考（rx-sns 準拠） |
|---|---|---|
| account_id | UUID | PK、identity.Account と 1:1 |
| **username** | string | @ハンドル。**case-insensitive 一意**。ログインでも使用（identity が username→account を解決）。reuse policy（下記） |
| **display_name**（表示名） | string | |
| **bio**（自己紹介） | text | **最大 160 文字** |
| **avatar_media_id** | UUID? | media スライス参照 |
| **cover_media_id** | UUID? | カバー画像（編集可）。media 参照 |
| **website**（ウェブサイト） | string? | URL |
| **sns_links** | JSONB | **X(Twitter) / Instagram / TikTok / Bluesky / LINE** の各 URL（rx-sns 実物の構造化リンク） |
| **prefecture**（都道府県） | string? | guest の場所。下記 Area モデル |
| **is_private**（鍵アカウント） | bool | 非公開。follow 承認の判定は social スライス |
| created_at / updated_at | time | |

### Cast extras（role=cast のみ、optional）

| フィールド | 型 | 備考 |
|---|---|---|
| **age**（年齢） | int? | |
| **height_cm**（身長） | int? | |
| **cup_size**（カップサイズ） | string? | select（rx-sns は cup のみ。bust/waist/hip は **無し**） |
| **industry**（業種 / service category） | string? | select。デリヘル/ソープ/個人 等の業態（旧 genres の置換）。値の確定は §10 domain spec |
| **活動エリア（areas）** | Area[] | **最大 2**、地方→都道府県→エリア（下記）。cast の活動地域 |
| **所属店舗（shop ref）** | UUID? | rx-sns に「所属店舗」設定あり。**shop ドメイン詳細は §10 で defer**、ここは参照のみ |

### Dropped（rx-sns にも無い / 商取引次元）

- blood_type、three_sizes の bust/waist/hip（**cup_size のみ残す**）
- plans / schedules / default_schedules / 出勤管理（offer スライス撤去・商取引）
- genres（旧マルチタグ taxonomy → 単一 `industry` select へ）

> role badge（ユーザー/セラピスト）は identity の role から導出。Profile には保持しない。

## username

- **profile 所有**の公開ハンドル（identity は email/phone+password を所有）。rx-sns ログインは「メールアドレスまたはユーザー名」なので、**identity の Login が username を受け付ける場合、profile を引いて account を解決**する（cross-slice。identity 側で username lookup の口を用意）。
- **case-insensitive 一意**（旧 `idx_casts_slug_lower` 同様 LOWER unique）。
- **内部参照は不変 account id(UUID)**、username は可変別名。メンションも id 参照（username 文字列で保存しない）。
- **再利用ポリシー = 長い cooldown + 元所有者優先**（変更/退会で空いた username は数ヶ月保留 → 元所有者のみ再取得可 → 開放）。風俗 SNS のなりすまし/カルテ誤帰属を重く見ての保守設定。

## Area モデル（rx-sns 実物準拠）

3 階層マスタ（rx-sns 設定の活動エリアを展開して確認）:

- **地方（8）**: 北海道・東北 / 関東 / 甲信越・北陸 / 東海 / 関西 / 中国 / 四国 / 九州・沖縄
- **都道府県**（例: 関東 → 茨城/栃木/群馬/埼玉/千葉/東京/神奈川）
- **エリア（leaf、クラスタ）**（例: 東京 → 池袋・赤羽・日暮里エリア / 新宿・中野エリア / 渋谷・恵比寿・六本木エリア / 五反田・新橋・蒲田エリア / 上野・秋葉原・錦糸町エリア / 西東京エリア）

- マスタ = `Area { id, prefecture, name(=エリアクラスタ), code, region(地方), sort_order, active }`（旧 `portfolio__areas` の prefecture+name+code を踏襲・地方を明示）。
- **cast = 活動エリア（Area を最大2）** / **guest = 都道府県（単一）**。
- 注: profile 編集フォームに `場所`(東京) 表示あり。これが活動エリア由来か別フィールドかは実装時に確認（本 spec では構造化 Area を canonical とする）。

## API contract — `proto/profile/v1`

`ProfileService`（旧 cast_service/guest_service を統合）:

| RPC | 概要 |
|---|---|
| `GetProfile` | account_id で取得 |
| `GetProfileByUsername` | username で取得（public profile URL `/u/<username>`） |
| `SaveProfile` | 共通 + cast extras を保存 |
| `CheckUsernameAvailability` | username 空き確認（case-insensitive） |
| `SaveProfileMedia` | avatar / cover の media_id 保存 |
| `ListAreas` | Area マスタ（地方→都道府県→エリア） |
| `ListProfiles` | 一覧（discovery が使う。filter は discovery スライスで詳細化） |

`Profile` message = 上記 共通 + cast extras。`Area` message = { id, prefecture, name, code, region }。

## Monolith profile slice（Ruby / Hanami / ROM）

- スライス名 `portfolio` → `profile`。テーブル `portfolio__*` → `profile__*`。
- relations: `profiles`（統合、旧 casts+guests を 1 テーブルに。role 別フィールドは nullable）/ `areas`（マスタ）/ `profile_areas`（cast の活動エリア join、最大2）。
- **撤去**: `cast_genres` / `genres` / offer 連動（plans/schedules/default_schedules）/ guest_prefectures は profiles.prefecture へ集約。
- `industry`（業種）は profiles の単一カラム（select 値）。
- presenter は `Profile` を返す。username の LOWER unique 制約。

## Frontend（BFF + データ層）

- `src/modules/portfolio` → `src/modules/profile`。proto stub 再生成（profile/v1）。
- 統合 Profile 型（共通 + cast extras）。編集フォームは rx-sns 準拠（表示名/自己紹介160/場所/ウェブサイト/年齢/身長/カップサイズ/業種/SNSリンク[X,IG,TikTok,Bluesky,LINE]/カバー/avatar）。
- 公開プロフィール `/u/<username>`。

## Deferred / out of scope

- **shop（所属店舗）ドメイン**: §10。profile は参照（shop_id）のみ持ち、shop エンティティ/管理は別 spec。
- **industry（業種）の値セット**（デリヘル/ソープ/個人 等の正式 enum）: §10 service-category domain spec。
- `場所` 表示と活動エリアの関係の最終確認（実装時）。
- httpOnly cookie 認証への移行は identity の frontend 再構築トラック。

## Relationship to existing code

旧 `portfolio` の casts/guests/areas/cast_areas は本マップに沿って `profile` へ再構築。areas マスタ（prefecture+name+code）は踏襲。plans/schedules/genres/blood_type/3sizes は撤去。新規 username を全 Profile に追加。
