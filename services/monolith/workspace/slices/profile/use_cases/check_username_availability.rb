# frozen_string_literal: true

module Profile
  module UseCases
    class CheckUsernameAvailability
      include Deps["repositories.profile_repository"]

      USERNAME_FORMAT = /\A[A-Za-z0-9_]{3,30}\z/

      def call(username:, account_id: nil)
        if username.nil? || !username.match?(USERNAME_FORMAT)
          return { available: false, message: "ユーザー名は半角英数字とアンダースコア3〜30文字です" }
        end

        if profile_repository.username_available?(username, exclude_account_id: account_id)
          { available: true, message: "" }
        else
          { available: false, message: "このユーザー名は使用されています" }
        end
      end
    end
  end
end
