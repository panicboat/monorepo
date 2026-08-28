# frozen_string_literal: true

require "stripe"
require "ostruct"
require "openssl"

module Spec
  module Billing
    class FakeStripeClient
      FAKE_SECRET = "whsec_fake"

      def initialize
        reset!
      end

      def reset!
        @customers = {}
        @customers_by_key = {}
        @subscriptions = {}
        @sessions = {}
        @portal_sessions = {}
        @seq = { customer: 0, subscription: 0, session: 0, portal: 0 }
        @raise_next = nil
        @recorded = []
      end

      def recorded_calls
        @recorded.dup
      end

      def raise_on_next_call(error)
        @raise_next = error
      end

      def inject_subscription(id:, customer_id:, price_id:, status:, current_period_end:,
                              cancel_at_period_end: false)
        @subscriptions[id] = OpenStruct.new(
          id: id, customer: customer_id,
          items: OpenStruct.new(data: [OpenStruct.new(price: OpenStruct.new(id: price_id))]),
          status: status,
          current_period_end: current_period_end.to_i,
          cancel_at_period_end: cancel_at_period_end,
          canceled_at: nil
        )
      end

      def create_customer(account_id:, idempotency_key:)
        maybe_raise!
        record(:create_customer, account_id: account_id, idempotency_key: idempotency_key)
        return @customers[@customers_by_key[idempotency_key]] if @customers_by_key.key?(idempotency_key)

        @seq[:customer] += 1
        id = "cus_fake_#{@seq[:customer]}"
        customer = OpenStruct.new(id: id, metadata: { "account_id" => account_id.to_s })
        @customers[id] = customer
        @customers_by_key[idempotency_key] = id
        customer
      end

      def create_checkout_session(customer_id:, price_id:, success_url:, cancel_url:, idempotency_key:)
        maybe_raise!
        record(:create_checkout_session, customer_id: customer_id, price_id: price_id,
                                          success_url: success_url, cancel_url: cancel_url,
                                          idempotency_key: idempotency_key)
        @seq[:session] += 1
        id = "cs_fake_#{@seq[:session]}"
        session = OpenStruct.new(id: id, url: "https://checkout.stripe.test/#{id}", customer: customer_id)
        @sessions[id] = session
        session
      end

      def create_billing_portal_session(customer_id:, return_url:, idempotency_key:)
        maybe_raise!
        record(:create_billing_portal_session, customer_id: customer_id, return_url: return_url,
                                                idempotency_key: idempotency_key)
        @seq[:portal] += 1
        id = "ps_fake_#{@seq[:portal]}"
        session = OpenStruct.new(id: id, url: "https://billing.stripe.test/#{id}")
        @portal_sessions[id] = session
        session
      end

      def retrieve_subscription(stripe_subscription_id:)
        maybe_raise!
        record(:retrieve_subscription, stripe_subscription_id: stripe_subscription_id)
        @subscriptions[stripe_subscription_id] || raise(Stripe::InvalidRequestError.new("No such subscription", nil))
      end

      def construct_webhook_event(payload:, sig_header:, secret:)
        record(:construct_webhook_event, payload_size: payload.bytesize, sig_present: !sig_header.nil?)
        ::Stripe::Webhook.construct_event(payload, sig_header, secret)
      end

      def generate_test_signature(payload:, timestamp: Time.now.to_i, secret: FAKE_SECRET)
        signed = "#{timestamp}.#{payload}"
        v1 = OpenSSL::HMAC.hexdigest("SHA256", secret, signed)
        "t=#{timestamp},v1=#{v1}"
      end

      private

      def maybe_raise!
        return unless @raise_next

        error = @raise_next
        @raise_next = nil
        raise error
      end

      def record(method, **args)
        @recorded << { method: method, args: args, at: Time.now }
      end
    end
  end
end
