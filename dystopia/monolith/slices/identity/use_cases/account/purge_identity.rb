# frozen_string_literal: true

require "cognito"

module Identity
  module UseCases
    module Account
      class PurgeIdentity
        include Identity::Deps[account_repo: "repositories.account_repository"]

        # Cross-slice foreign keys are intentionally absent, so hard deletion
        # must cascade through each slice before the identity account is removed.
        def initialize(cascades:, **kwargs)
          super(**kwargs)
          @cascades = cascades
        end

        def call(sub:)
          @cascades.each { |cascade| cascade.call(account_id: sub) rescue nil } # SILENT: A failed slice purge must not prevent remaining account data from being removed.
          Cognito.admin_delete_user(sub: sub)
          account_repo.delete(sub)
          nil
        end
      end
    end
  end
end
