# frozen_string_literal: true

require "cognito"

module Identity
  module UseCases
    module Account
      class ReleaseIncompleteSignUp
        include Identity::Deps[account_repo: "repositories.account_repository"]

        # An account row means the sign-up completed, so the Cognito user must stay whatever its status.
        def call(username:)
          user = Cognito.find_user(username: username)
          return false unless user
          return false if account_repo.find_by_id(user.sub)

          Cognito.delete_user(username: username)
          true
        end
      end
    end
  end
end
