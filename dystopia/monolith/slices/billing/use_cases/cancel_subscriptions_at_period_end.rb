# frozen_string_literal: true

module Billing
  module UseCases
    class CancelSubscriptionsAtPeriodEnd
      include Billing::Deps[
        subscription_repo: "repositories.subscription_repository",
        stripe_client: "adapters.stripe_client"
      ]

      # Raises on the first Stripe failure; rows already updated stay updated and a retry repeats the rest.
      def call(account_id:)
        subscription_repo.list_uncanceled_by_account_id(account_id).each do |row|
          stripe_client.cancel_at_period_end(stripe_subscription_id: row.stripe_subscription_id)
          subscription_repo.mark_cancel_at_period_end(stripe_subscription_id: row.stripe_subscription_id)
        end
        nil
      end
    end
  end
end
