# frozen_string_literal: true

module Identity
  module UseCases
    module Account
      class ReactivateAccount
        include Identity::Deps[repo: "repositories.account_repository"]

        def call(sub:)
          repo.reactivate(sub)
          repo.find_by_id(sub)
        end
      end
    end
  end
end
