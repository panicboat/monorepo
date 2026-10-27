# frozen_string_literal: true

require "cognito"

module Identity
  module UseCases
    module Account
      class PurgeIdentity
        include Identity::Deps[account_repo: "repositories.account_repository"]

        def initialize(purge_profiles: nil, purge_push_subscriptions: nil, purge_billing: nil, **kwargs)
          super(**kwargs)
          @purge_profiles = purge_profiles
          @purge_push_subscriptions = purge_push_subscriptions
          @purge_billing = purge_billing
        end

        # Raises on the first failure so the account stays deactivated and the next run repeats the purge.
        def call(sub:)
          purge_profiles.call(account_id: sub)
          purge_push_subscriptions.call(account_id: sub)
          purge_billing.call(account_id: sub)
          Cognito.admin_delete_user(sub: sub)
          account_repo.delete(sub)
          nil
        end

        private

        def purge_profiles
          @purge_profiles ||= ::Profile::Slice["use_cases.purge_account"]
        end

        def purge_push_subscriptions
          @purge_push_subscriptions ||= ::Notifications::Slice["use_cases.purge_account"]
        end

        def purge_billing
          @purge_billing ||= ::Billing::Slice["use_cases.purge_account"]
        end
      end
    end
  end
end
