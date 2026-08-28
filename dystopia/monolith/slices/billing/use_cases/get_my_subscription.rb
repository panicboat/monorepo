# frozen_string_literal: true

module Billing
  module UseCases
    class GetMySubscription
      include Billing::Deps[
        subscription_repo: "repositories.subscription_repository"
      ]

      def initialize(subscription_repo: nil, **kwargs)
        super(**kwargs.merge(subscription_repo: subscription_repo).compact)
      end

      def call(account_id:)
        row = subscription_repo.find_by_account_id(account_id)
        return nil unless row

        {
          status: row.status,
          current_period_end: row.current_period_end,
          cancel_at_period_end: row.cancel_at_period_end,
          price_id: row.stripe_price_id
        }
      end
    end
  end
end
