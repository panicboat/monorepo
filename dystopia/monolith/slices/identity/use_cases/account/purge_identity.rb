# frozen_string_literal: true

require "cognito"

module Identity
  module UseCases
    module Account
      class PurgeIdentity
        include Identity::Deps[account_repo: "repositories.account_repository"]

        def initialize(purge_profiles: nil, purge_karte: nil, **kwargs)
          super(**kwargs)
          @purge_profiles = purge_profiles
          @purge_karte = purge_karte
        end

        # Raises on the first failure so the account stays deactivated and the next run repeats the purge.
        def call(sub:)
          purge_profiles.call(account_id: sub)
          purge_karte.call(account_id: sub)
          Cognito.admin_delete_user(sub: sub)
          account_repo.delete(sub)
          nil
        end

        private

        def purge_profiles
          @purge_profiles ||= ::Profile::Slice["use_cases.purge_account"]
        end

        def purge_karte
          @purge_karte ||= ::Karte::Slice["use_cases.purge_account"]
        end
      end
    end
  end
end
