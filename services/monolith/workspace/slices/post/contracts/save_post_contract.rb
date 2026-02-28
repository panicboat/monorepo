# frozen_string_literal: true

require "dry/validation"

module Post
  module Contracts
    class SavePostContract < Dry::Validation::Contract
      MAX_CONTENT_LENGTH = 5000

      MAX_HASHTAG_LENGTH = 100
      MAX_HASHTAGS = 10

      params do
        required(:cast_user_id).filled(:string)
        optional(:id).maybe(:string)
        optional(:content).maybe(:string)
        optional(:visibility).maybe(:string, included_in?: %w[public private])
        optional(:media).array(:hash) do
          required(:media_type).filled(:string, included_in?: %w[image video])
          required(:media_id).filled(:string)
        end
        optional(:hashtags).array(:string)
      end

      rule do
        if values[:id].to_s.empty? && values[:content].to_s.empty? && (values[:media].nil? || values[:media].empty?)
          base.failure("content or media is required")
        end
      end

      rule(:content) do
        key.failure("は#{MAX_CONTENT_LENGTH}文字以内で入力してください") if value && value.length > MAX_CONTENT_LENGTH
      end

      rule(:hashtags) do
        next unless value

        key.failure("は#{MAX_HASHTAGS}個以内で入力してください") if value.length > MAX_HASHTAGS
        value.each_with_index do |tag, _i|
          key.failure("は#{MAX_HASHTAG_LENGTH}文字以内で入力してください") if tag && tag.length > MAX_HASHTAG_LENGTH
        end
      end
    end
  end
end
