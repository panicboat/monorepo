# frozen_string_literal: true

require "dry/validation"

module Portfolio
  module Contracts
    module Cast
      class SaveProfileContract < Dry::Validation::Contract
        MAX_NAME_LENGTH = 100
        MAX_BIO_LENGTH = 1000
        MAX_TAGLINE_LENGTH = 200
        MIN_SLUG_LENGTH = 3
        MAX_SLUG_LENGTH = 30
        SLUG_FORMAT = /\A[a-zA-Z][a-zA-Z0-9]*\z/

        params do
          required(:user_id).filled(:string)
          required(:name).filled(:string)
          required(:bio).filled(:string)
          optional(:slug).maybe(:string)
          optional(:tagline).maybe(:string)
          optional(:default_schedules).maybe(:array)
          optional(:social_links).maybe(:hash)
          optional(:age).maybe(:integer)
          optional(:height).maybe(:integer)
          optional(:blood_type).maybe(:string)
          optional(:three_sizes).maybe(:hash)
          optional(:tags).maybe(:array)
        end

        rule(:name) do
          key.failure("は空白のみでは登録できません") if value.strip.empty?
          key.failure("は#{MAX_NAME_LENGTH}文字以内で入力してください") if value.length > MAX_NAME_LENGTH
        end

        rule(:bio) do
          key.failure("は#{MAX_BIO_LENGTH}文字以内で入力してください") if value.length > MAX_BIO_LENGTH
        end

        rule(:tagline) do
          if key? && value && value.length > MAX_TAGLINE_LENGTH
            key.failure("は#{MAX_TAGLINE_LENGTH}文字以内で入力してください")
          end
        end

        rule(:slug) do
          next unless key? && value

          if value.length < MIN_SLUG_LENGTH
            key.failure("は#{MIN_SLUG_LENGTH}文字以上で入力してください")
          elsif value.length > MAX_SLUG_LENGTH
            key.failure("は#{MAX_SLUG_LENGTH}文字以内で入力してください")
          elsif !value.match?(SLUG_FORMAT)
            if value.match?(/\A[0-9]/)
              key.failure("は先頭に数字を使用できません")
            else
              key.failure("は英数字のみ使用できます")
            end
          end
        end

        rule(:default_schedules) do
          next unless key? && value

          value.each_with_index do |schedule, idx|
            unless schedule.is_a?(Hash) && schedule[:start] && schedule[:end]
              key.failure("の#{idx + 1}番目は start と end が必要です")
              next
            end

            start_time = schedule[:start].to_s
            end_time = schedule[:end].to_s

            unless start_time.match?(/\A([01]?[0-9]|2[0-3]):[0-5][0-9]\z/)
              key.failure("の#{idx + 1}番目の開始時刻は有効な時刻形式（HH:MM）で入力してください")
            end
            unless end_time.match?(/\A([01]?[0-9]|2[0-3]):[0-5][0-9]\z/)
              key.failure("の#{idx + 1}番目の終了時刻は有効な時刻形式（HH:MM）で入力してください")
            end
            if start_time >= end_time
              key.failure("の#{idx + 1}番目の開始時刻は終了時刻より前である必要があります")
            end
          end
        end
      end
    end
  end
end
