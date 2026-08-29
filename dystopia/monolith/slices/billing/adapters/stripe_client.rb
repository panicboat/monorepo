# frozen_string_literal: true

require "stripe"

module Billing
  module Adapters
    class StripeClient
      def initialize(api_key:)
        @api_key = api_key
      end

      def create_customer(account_id:, idempotency_key:)
        ::Stripe::Customer.create(
          { metadata: { account_id: account_id.to_s } },
          { api_key: @api_key, idempotency_key: idempotency_key }
        )
      end

      def create_checkout_session(customer_id:, price_id:, success_url:, cancel_url:, idempotency_key:)
        ::Stripe::Checkout::Session.create(
          {
            mode: "subscription",
            customer: customer_id,
            line_items: [{ price: price_id, quantity: 1 }],
            success_url: success_url,
            cancel_url: cancel_url
          },
          { api_key: @api_key, idempotency_key: idempotency_key }
        )
      end

      def create_billing_portal_session(customer_id:, return_url:, idempotency_key:)
        ::Stripe::BillingPortal::Session.create(
          { customer: customer_id, return_url: return_url },
          { api_key: @api_key, idempotency_key: idempotency_key }
        )
      end

      def retrieve_subscription(stripe_subscription_id:)
        ::Stripe::Subscription.retrieve(stripe_subscription_id, { api_key: @api_key })
      end

      def construct_webhook_event(payload:, sig_header:, secret:)
        ::Stripe::Webhook.construct_event(payload, sig_header, secret)
      end
    end
  end
end
