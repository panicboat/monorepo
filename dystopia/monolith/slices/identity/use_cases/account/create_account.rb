# frozen_string_literal: true

module Identity
  module UseCases
    module Account
      class CreateAccount
        class AccountAlreadyExists < StandardError; end

        include Identity::Deps[repo: "repositories.account_repository"]

        def call(sub:, role:)
          repo.create(sub: sub, role: role)
        rescue Sequel::UniqueConstraintViolation
          raise AccountAlreadyExists, "account already exists"
        end
      end
    end
  end
end
