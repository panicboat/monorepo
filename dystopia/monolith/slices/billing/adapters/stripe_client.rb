# frozen_string_literal: true

require "stripe"

module Billing
  module Adapters
    class StripeClient
      def initialize(api_key:)
        @client = ::Stripe::StripeClient.new(api_key)
      end

      def create_customer(account_id:, idempotency_key:)
        @client.v1.customers.create(
          { metadata: { account_id: account_id.to_s } },
          { idempotency_key: idempotency_key }
        )
      end

      def create_checkout_session(customer_id:, price_id:, success_url:, cancel_url:, idempotency_key:)
        @client.v1.checkout.sessions.create(
          {
            mode: "subscription",
            customer: customer_id,
            line_items: [{ price: price_id, quantity: 1 }],
            success_url: success_url,
            cancel_url: cancel_url,
            integration_identifier: "billing-EXeWm39u"
          },
          { idempotency_key: idempotency_key }
        )
      end

      def create_billing_portal_session(customer_id:, return_url:, idempotency_key:)
        @client.v1.billing_portal.sessions.create(
          { customer: customer_id, return_url: return_url },
          { idempotency_key: idempotency_key }
        )
      end

      def retrieve_subscription(stripe_subscription_id:)
        @client.v1.subscriptions.retrieve(stripe_subscription_id)
      end

      def construct_webhook_event(payload:, sig_header:, secret:)
        ::Stripe::Webhook.construct_event(payload, sig_header, secret)
      end
    end
  end
end
