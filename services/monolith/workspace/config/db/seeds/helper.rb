# frozen_string_literal: true

require "bcrypt"
require "securerandom"

module Seeds
  module Helper
    def self.db
      @db ||= Hanami.app["db.gateway"].connection
    end

    def self.password_digest
      @password_digest ||= BCrypt::Password.create("0000")
    end

    def self.insert_unless_exists(table, unique_column, unique_value, data, return_column: :id)
      existing = db[table].where(unique_column => unique_value).first
      return existing[return_column] if existing

      db[table].insert(data.merge(unique_column => unique_value))
      db[table].where(unique_column => unique_value).first[return_column]
    end

    def self.print_summary
      puts ""
      puts "=" * 80
      puts "Seed completed!"
      puts "=" * 80
      puts ""
      puts "Test Accounts (password: 0000):"
      puts ""
      puts "  CAST ACCOUNTS:"
      puts "    09011111111 - Yuna  (visibility: public)  - PublicキャストのPublic/Private投稿"
      puts "    09022222222 - Mio   (visibility: private) - PrivateキャストのPublic/Private投稿"
      puts "    09033333333 - Rin   (visibility: public)  - PublicキャストのPublic/Private投稿"
      puts ""
      puts "  GUEST ACCOUNTS:"
      puts "    08011111111 - 太郎 - Yuna+Mioをフォロー済み → 両キャストの全投稿閲覧可能"
      puts "    08022222222 - 次郎 - 誰もフォローしていない → PublicキャストのPublic投稿のみ"
      puts "    08033333333 - 三郎 - Mioにフォロー申請中(pending) → PublicキャストのPublic投稿のみ"
      puts "    08044444444 - 四郎 - Rinのみフォロー済み → Rinの全投稿 + 他PublicキャストのPublic投稿"
      puts ""
      puts "  Follow: 太郎→Yuna(approved), 太郎→Mio(approved), 三郎→Mio(pending), 四郎→Rin(approved)"
      puts "  Block:  Rin→太郎(blocked)"
      puts ""
    end
  end
end
