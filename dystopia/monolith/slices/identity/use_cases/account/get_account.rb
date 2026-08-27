# frozen_string_literal: true

module Identity
  module UseCases
    module Account
      class GetAccount
        include Identity::Deps[repo: "repositories.account_repository"]

        def call(sub:)
          repo.find_by_id(sub)
        end
      end
    end
  end
end
