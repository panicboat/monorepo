# frozen_string_literal: true

module Billing
  module UseCases
    class CreateCustomerPortalSession
      class CustomerNotCreatedError < StandardError; end

      include Billing::Deps[
        customer_repo: "repositories.customer_repository",
        stripe_client: "adapters.stripe_client"
      ]

      def initialize(customer_repo: nil, stripe_client: nil, return_url: nil, **kwargs)
        super(**kwargs.merge(customer_repo: customer_repo, stripe_client: stripe_client).compact)
        @return_url = return_url || Hanami.app["settings"].billing_portal_return_url
      end

      def call(account_id:)
        row = customer_repo.find_by_account_id(account_id)
        raise CustomerNotCreatedError, "account=#{account_id} has no Stripe customer" unless row

        session = stripe_client.create_billing_portal_session(
          customer_id: row.stripe_customer_id,
          return_url: @return_url,
          idempotency_key: "billing:create_portal:#{account_id}:#{Time.now.strftime('%Y%m%d%H')}"
        )
        { url: session.url }
      end
    end
  end
end
