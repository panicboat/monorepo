# frozen_string_literal: true

require "securerandom"

module Seeds
  module Helper
    def self.db
      @db ||= Hanami.app["db.gateway"].connection
    end

    def self.insert_unless_exists(table, unique_column, unique_value, data, return_column: :id)
      existing = db[table].where(unique_column => unique_value).first
      return existing[return_column] if existing

      db[table].insert(data.merge(id: SecureRandom.uuid_v7, unique_column => unique_value))
      db[table].where(unique_column => unique_value).first[return_column]
    end

    def self.print_summary
      puts ""
      puts "=" * 80
      puts "Seed completed!"
      puts "=" * 80
      puts ""
      puts "Test Accounts (password: password):"
      puts ""
      puts "  CAST ACCOUNTS:"
      puts "    +819000000101 - Yuna  (visibility: public)  - PublicキャストのPublic/Private投稿"
      puts "                    2つ目のプロフィール @yuna_osaka (有効) → プロフィールの切り替え"
      puts "    +819000000102 - Mio   (visibility: private) - PrivateキャストのPublic/Private投稿"
      puts "                    2つ目のプロフィール @mio_kyoto (無効) → 再有効化・削除"
      puts "    +819000000103 - Rin   (visibility: public)  - PublicキャストのPublic/Private投稿"
      puts ""
      puts "  GUEST ACCOUNTS:"
      puts "    +819000000104 - 太郎 - Yuna+Mioをフォロー済み → 両キャストの全投稿閲覧可能"
      puts "    +819000000105 - 次郎 - 誰もフォローしていない → PublicキャストのPublic投稿のみ"
      puts "    +819000000106 - 三郎 - Mioにフォロー申請中(pending) → PublicキャストのPublic投稿のみ"
      puts "    +819000000107 - 四郎 - Rinのみフォロー済み → Rinの全投稿 + 他PublicキャストのPublic投稿"
      puts ""
      puts "  OTHER REGISTRATION STATES:"
      puts "    +819000000108 - 五郎 (guest) - 退会済み(猶予期間中) → ログインで復帰"
      puts "    +819000000109 - (cast)  - プロフィール未作成 → オンボーディング"
      puts "    +819000000110 - (guest) - プロフィール未作成 → オンボーディング"
      puts ""
      puts "  Follow: 太郎→Yuna(approved), 太郎→Mio(approved), 三郎→Mio(pending), 四郎→Rin(approved)"
      puts "  Block:  Rin→太郎(blocked)"
      puts "  DM:     太郎↔Yuna, 太郎↔Mio, 四郎↔Rin, Yuna→次郎"
      puts "  Karte:  Yuna→太郎, Mio→太郎, Rin→四郎, Yuna→次郎"
      puts "  Review: 太郎→Yuna, 太郎→Mio, 四郎→Rin, 次郎→Yuna"
      puts "  Post:   Yuna の固定投稿, Mio の時間限定投稿, Rin の引用+メンション投稿, Rin の予定のお知らせ"
      puts ""
    end
  end
end
