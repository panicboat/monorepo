# DB シードリファクタリング設計

## 背景

`seeds.rb` が839行の巨大な単一ファイルに成長し、見通しが悪くなった。また `bulk/` ディレクトリのジェネレーター構成が複雑すぎてメンテナンスコストが高い。

## ゴール

1. `seeds.rb` をドメイン/テーブル単位にファイル分割する
2. `bulk/` ディレクトリを完全廃止する
3. ベースのゲスト・キャストデータの値は変更しない
4. ページネーション/無限スクロールテスト用にデータ量を少し増やす

## ファイル構成

```
config/db/seeds/
├── seeds.rb              # オーケストレーター（ロード順定義 + サマリー出力）
├── helper.rb             # 共通ヘルパー（DB接続、bcrypt、insert_unless_exists）
├── identity/
│   └── users.rb          # Cast 3名 + Guest 4名のユーザー作成
├── portfolio/
│   ├── areas.rb          # マスターデータ: エリア 23件
│   ├── genres.rb         # マスターデータ: ジャンル 7件
│   ├── casts.rb          # キャストプロフィール 3名
│   ├── guests.rb         # ゲストプロフィール 4名
│   └── assignments.rb    # cast_genres + cast_areas の関連付け
├── offer/
│   ├── plans.rb          # プラン 9件（3名×3プラン）
│   └── schedules.rb      # スケジュール ~20件
├── post/
│   ├── posts.rb          # 投稿 ~50件（ページネーション対応）
│   ├── likes.rb          # いいね ~100件
│   └── comments.rb       # コメント + リプライ ~100件
├── relationship/
│   ├── follows.rb        # フォロー関係 4件
│   └── blocks.rb         # ブロック 1件
└── trust/
    ├── taggings.rb       # タグ付け 3件
    └── reviews.rb        # レビュー ~30件
```

`bulk/` ディレクトリは完全削除する。

## オーケストレーター（seeds.rb）

ロード順のみを定義する薄いファイル。

```ruby
require_relative "helper"

# === Master Data ===
require_relative "portfolio/areas"
require_relative "portfolio/genres"

# === Users ===
require_relative "identity/users"

# === Profiles ===
require_relative "portfolio/casts"
require_relative "portfolio/guests"
require_relative "portfolio/assignments"

# === Offer ===
require_relative "offer/plans"
require_relative "offer/schedules"

# === Content ===
require_relative "post/posts"
require_relative "post/likes"
require_relative "post/comments"

# === Relationships ===
require_relative "relationship/follows"
require_relative "relationship/blocks"

# === Trust ===
require_relative "trust/taggings"
require_relative "trust/reviews"

# === Summary ===
Seeds::Helper.print_summary
```

## helper.rb

共通ヘルパーを module にまとめる。

```ruby
require "bcrypt"

module Seeds
  module Helper
    DB = Hanami.app["db.rom"].gateways[:default].connection
    PASSWORD = BCrypt::Password.create("0000")

    def self.insert_unless_exists(table, key_column, key_value, attributes)
      existing = DB[table].where(key_column => key_value).first
      return existing[:id] if existing
      DB[table].insert(attributes)
    end

    def self.print_summary
      # テストアカウント情報、各テーブルの件数を出力
    end
  end
end
```

## データ増量

bulk 廃止の代わりにベースデータを増量し、ページネーション/無限スクロールのテストに対応する。

| データ | 現在 | 変更後 | 理由 |
|--------|------|--------|------|
| キャスト | 3名 | 3名（変更なし） | ベースデータ維持 |
| ゲスト | 4名 | 4名（変更なし） | ベースデータ維持 |
| 投稿 | 9件 | ~50件 | 無限スクロールテスト（1ページ20件×3ページ分） |
| いいね | ~16件 | ~100件 | 投稿増に比例 |
| コメント | ~30件 | ~100件 | コメント一覧のページネーション |
| フォロー | 4件 | 4件（変更なし） | 十分 |
| レビュー | ~18件 | ~30件 | レビュー一覧の表示確認 |

増量分は固定データとして直書き（ランダム生成しない）。投稿テンプレートを用意してキャストごとにバリエーションを持たせる。

## 冪等性

全ファイルで `insert_unless_exists` パターンを統一使用。`hanami db seed` を複数回実行してもデータ重複なし。

## テスト方針

1. `hanami db reset` → `hanami db seed` で全件正常作成を確認
2. 2回連続 `seed` で重複なしを確認
3. 各ドメインファイルはログ出力（`puts "=== Seeding Identity::Users ==="` 等）で進捗を可視化
