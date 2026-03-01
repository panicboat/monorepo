# frozen_string_literal: true

module Errors
  class ValidationError < StandardError
    FIELD_NAMES = {
      phone_number: "電話番号",
      password: "パスワード",
      role: "ロール",
      code: "認証コード",
      name: "名前",
      bio: "自己紹介",
      slug: "ユーザー名",
      tagline: "一言紹介",
      content: "本文",
      hashtags: "ハッシュタグ",
      media: "メディア",
      visibility: "公開範囲",
      plans: "プラン",
      price: "料金",
      duration_minutes: "時間",
      schedules: "スケジュール",
      start_time: "開始時刻",
      end_time: "終了時刻",
      date: "日付",
      default_schedules: "デフォルトスケジュール",
    }.freeze

    attr_reader :errors

    def initialize(errors)
      @errors = errors
      super(format_message(errors))
    end

    private

    def format_message(errors)
      return errors.to_s unless errors.respond_to?(:to_h)

      errors_hash = errors.to_h
      return errors.to_s if errors_hash.empty?

      msg = extract_first_message(errors_hash)
      msg || errors.to_s
    end

    def extract_first_message(hash)
      hash.each do |key, value|
        case value
        when Array
          msg = value.first
          next unless msg

          return msg.to_s if key.nil? || key == :base
          return "#{FIELD_NAMES.fetch(key, key.to_s)}#{msg}"
        when Hash
          result = extract_first_message(value)
          return result if result
        end
      end
      nil
    end
  end
end
