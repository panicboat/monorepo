# frozen_string_literal: true

module Billing
  module UseCases
    class PurgeAccount
      include Billing::Deps[
        customer_repo: "repositories.customer_repository",
        subscription_repo: "repositories.subscription_repository",
        stripe_client: "adapters.stripe_client"
      ]

      # Stripe goes first so a failure leaves the rows that a retry needs to find the customer again.
      def call(account_id:)
        customer = customer_repo.find_by_account_id(account_id)
        stripe_client.delete_customer(stripe_customer_id: customer.stripe_customer_id) if customer
        customer_repo.transaction do
          subscription_repo.delete_by_account_id(account_id)
          customer_repo.delete_by_account_id(account_id)
        end
        nil
      end
    end
  end
end
