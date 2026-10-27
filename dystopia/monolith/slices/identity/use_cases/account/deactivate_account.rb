# frozen_string_literal: true

module Identity
  module UseCases
    module Account
      class DeactivateAccount
        include Identity::Deps[repo: "repositories.account_repository"]

        def initialize(cancel_subscriptions: nil, **kwargs)
          super(**kwargs)
          @cancel_subscriptions = cancel_subscriptions
        end

        # Cancels before marking so a Stripe failure leaves the account active and the request retryable.
        def call(sub:)
          account = repo.find_by_id(sub)
          return nil if account.nil? || account.deactivated_at

          cancel_subscriptions.call(account_id: sub)
          repo.mark_deactivated(sub)
          nil
        end

        private

        def cancel_subscriptions
          @cancel_subscriptions ||= ::Billing::Slice["use_cases.cancel_subscriptions_at_period_end"]
        end
      end
    end
  end
end
