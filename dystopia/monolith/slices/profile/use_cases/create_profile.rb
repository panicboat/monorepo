# frozen_string_literal: true

require "errors/validation_error"

module Profile
  module UseCases
    class CreateProfile
      class LimitExceededError < StandardError; end
      class AccountNotFoundError < StandardError; end

      include Deps["repositories.profile_repository"]

      ROLE_CAST = 2
      CAST_PROFILE_LIMIT = 5
      SINGLE_PROFILE_LIMIT = 1

      def call(account_id:, display_name:, username: nil)
        validate_display_name!(display_name)
        validate_username!(username) unless username.nil?

        account = identity_account_repo.find_by_id(account_id)
        raise AccountNotFoundError, "Account not found" unless account

        attrs = { display_name: display_name }
        attrs[:username] = username unless username.nil?

        profile = profile_repository.create_within_limit(
          account_id: account_id,
          limit: limit_for(account),
          attrs: attrs
        )
        raise LimitExceededError, "作成できるプロフィールの上限に達しています" unless profile

        profile
      end

      private

      def limit_for(account)
        account.role == ROLE_CAST ? CAST_PROFILE_LIMIT : SINGLE_PROFILE_LIMIT
      end

      def identity_account_repo
        @identity_account_repo ||= ::Identity::Slice["repositories.account_repository"]
      end

      def validate_display_name!(value)
        if value.nil? || value.strip.empty?
          raise Errors::ValidationError, "表示名は必須です"
        end
        if value.length > SaveProfile::DISPLAY_NAME_MAX
          raise Errors::ValidationError, "表示名は#{SaveProfile::DISPLAY_NAME_MAX}文字以内で入力してください"
        end
      end

      def validate_username!(value)
        unless value.match?(SaveProfile::USERNAME_FORMAT)
          raise Errors::ValidationError, "ユーザー名は半角英数字とアンダースコア3〜30文字です"
        end
        unless profile_repository.username_available?(value)
          raise Errors::ValidationError, "このユーザー名は使用できません"
        end
      end
    end
  end
end
