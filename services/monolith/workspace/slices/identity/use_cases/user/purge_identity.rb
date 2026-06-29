# frozen_string_literal: true

module Identity
  module UseCases
    module User
      class PurgeIdentity
        include Identity::Deps[
          user_repo: "repositories.user_repository",
          refresh_repo: "repositories.refresh_token_repository",
          verification_repo: "repositories.sms_verification_repository"
        ]

        def call(account_id:)
          user = user_repo.find_by_id(account_id)
          return nil unless user

          refresh_repo.delete_by_user_id(account_id)
          verification_repo.delete_by_phone_number(user.phone_number)
          user_repo.delete(account_id)
          nil
        end
      end
    end
  end
end
