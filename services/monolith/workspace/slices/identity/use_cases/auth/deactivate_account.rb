# frozen_string_literal: true

module Identity
  module UseCases
    module Auth
      class DeactivateAccount
        class DeactivationError < StandardError; end

        include Identity::Deps[repo: "repositories.user_repository"]

        def call(viewer_account_id:)
          user = repo.find_by_id(viewer_account_id)
          raise DeactivationError, "User not found" unless user

          # Idempotent: already-deactivated accounts are not re-stamped.
          return nil if user.deactivated_at

          repo.deactivate(viewer_account_id)
          nil
        end
      end
    end
  end
end
