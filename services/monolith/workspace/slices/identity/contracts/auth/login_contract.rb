# frozen_string_literal: true

require "dry/validation"

module Identity
  module Contracts
    module Auth
      class LoginContract < Dry::Validation::Contract
        PHONE_NUMBER_REGEX = /\A\+?[0-9]{10,15}\z/
        VALID_ROLES = [1, 2].freeze # 1: GUEST, 2: CAST

        params do
          required(:phone_number).filled(:string)
          required(:password).filled(:string)
          optional(:role).filled(:integer)
        end

        rule(:phone_number) do
          unless value.match?(PHONE_NUMBER_REGEX)
            key.failure("は有効な電話番号形式で入力してください（10〜15桁の数字）")
          end
        end

        rule(:password) do
          key.failure("は必須です") if value.empty?
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
