# frozen_string_literal: true

module Identity
  module UseCases
    module Account
      class DeactivateAccount
        include Identity::Deps[repo: "repositories.account_repository"]

        def call(sub:)
          repo.mark_deactivated(sub)
          nil
        end
      end
    end
  end
end
