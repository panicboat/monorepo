# frozen_string_literal: true

require "dry/validation"

module Identity
  module Contracts
    module Verification
      class VerifyCodeContract < Dry::Validation::Contract
        PHONE_NUMBER_REGEX = /\A\+?[0-9]{10,15}\z/
        CODE_LENGTH = 4

        params do
          required(:phone_number).filled(:string)
          required(:code).filled(:string)
        end

        rule(:phone_number) do
          unless value.match?(PHONE_NUMBER_REGEX)
            key.failure("は有効な電話番号形式で入力してください（10〜15桁の数字）")
          end
        end

        rule(:code) do
          unless value.match?(/\A[0-9]{#{CODE_LENGTH}}\z/)
            key.failure("は#{CODE_LENGTH}桁の数字で入力してください")
          end
        end
      end
    end
  end
end
