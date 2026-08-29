# frozen_string_literal: true

module Billing
  module Queries
    class ActiveSubscription
      include Billing::Deps[
        subscription_repo: "repositories.subscription_repository"
      ]

      def initialize(subscription_repo: nil, **kwargs)
        super(**kwargs.merge(subscription_repo: subscription_repo).compact)
      end

      def call(account_id)
        subscription_repo.find_active_by_account_id(account_id)
      end
    end
  end
end
