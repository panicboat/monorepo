# frozen_string_literal: true

require "dry/validation"

module Social
  module Contracts
    class SavePostContract < Dry::Validation::Contract
      MAX_CONTENT_LENGTH = 5000

      params do
        required(:cast_id).filled(:string)
        optional(:id).maybe(:string)
        optional(:content).maybe(:string)
        optional(:visible).maybe(:bool)
        optional(:media).array(:hash) do
          required(:media_type).filled(:string, included_in?: %w[image video])
          required(:url).filled(:string)
          optional(:thumbnail_url).maybe(:string)
        end
      end

      rule do
        if values[:id].to_s.empty? && values[:content].to_s.empty? && (values[:media].nil? || values[:media].empty?)
          base.failure("content or media is required")
        end
      end

      rule(:content) do
        key.failure("は#{MAX_CONTENT_LENGTH}文字以内で入力してください") if value && value.length > MAX_CONTENT_LENGTH
      end
    end
  end
end
