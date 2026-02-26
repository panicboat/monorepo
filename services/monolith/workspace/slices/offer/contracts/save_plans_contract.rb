# frozen_string_literal: true

require "dry/validation"

module Offer
  module Contracts
    class SavePlansContract < Dry::Validation::Contract
      MAX_NAME_LENGTH = 100
      MIN_PRICE = 0
      MAX_PRICE = 10_000_000
      MIN_DURATION = 15
      MAX_DURATION = 1440 # 24 hours

      params do
        required(:cast_user_id).filled(:string)
        required(:plans).array(:hash) do
          required(:name).filled(:string)
          required(:price).filled(:integer)
          required(:duration_minutes).filled(:integer)
          optional(:is_recommended).filled(:bool)
        end
      end

      rule(:plans).each do |index:|
        plan = value

        if plan[:name] && plan[:name].strip.empty?
          key([:plans, index, :name]).failure("は空白のみでは登録できません")
        end

        if plan[:name] && plan[:name].length > MAX_NAME_LENGTH
          key([:plans, index, :name]).failure("は#{MAX_NAME_LENGTH}文字以内で入力してください")
        end

        if plan[:price] && (plan[:price] < MIN_PRICE || plan[:price] > MAX_PRICE)
          key([:plans, index, :price]).failure("は#{MIN_PRICE}〜#{MAX_PRICE}円の範囲で入力してください")
        end

        if plan[:duration_minutes] && (plan[:duration_minutes] < MIN_DURATION || plan[:duration_minutes] > MAX_DURATION)
          key([:plans, index, :duration_minutes]).failure("は#{MIN_DURATION}〜#{MAX_DURATION}分の範囲で入力してください")
        end
      end
    end
  end
end
