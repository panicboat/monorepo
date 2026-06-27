# frozen_string_literal: true

require "dry/validation"

module Identity
  module Contracts
    module Auth
      class RegisterContract < Dry::Validation::Contract
        PHONE_NUMBER_REGEX = /\A\+?[0-9]{10,15}\z/
        MIN_PASSWORD_LENGTH = 8
        VALID_ROLES = [1, 2].freeze # 1: GUEST, 2: CAST

        params do
          required(:phone_number).filled(:string)
          required(:password).filled(:string)
          required(:verification_token).filled(:string)
          optional(:role).filled(:integer)
        end

        rule(:phone_number) do
          unless value.match?(PHONE_NUMBER_REGEX)
            key.failure("は有効な電話番号形式で入力してください（10〜15桁の数字）")
          end
        end

        rule(:password) do
          if value.length < MIN_PASSWORD_LENGTH
            key.failure("は#{MIN_PASSWORD_LENGTH}文字以上で入力してください")
          end
        end

        rule(:role) do
          if key? && !VALID_ROLES.include?(value)
            key.failure("は有効なロール（1: GUEST, 2: CAST）を指定してください")
          end
        end
      end
    end
  end
end
