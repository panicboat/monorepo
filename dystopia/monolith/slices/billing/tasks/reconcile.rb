# frozen_string_literal: true

module Billing
  module Tasks
    class Reconcile
      def initialize(customer_repo:, subscription_repo:, stripe_client:)
        @customer_repo = customer_repo
        @subscription_repo = subscription_repo
        @stripe_client = stripe_client
      end

      def call
        checked = 0
        updated = 0
        errors = 0

        @customer_repo.all.each do |customer|
          begin
            local_sub = @subscription_repo.find_by_account_id(customer.account_id)
            stripe_sub = fetch_stripe_subscription(local_sub&.stripe_subscription_id)
            checked += 1
            next unless stripe_sub

            if needs_update?(local_sub, stripe_sub)
              @subscription_repo.upsert_by_stripe_id(
                account_id: customer.account_id,
                stripe_subscription_id: stripe_sub.id,
                stripe_price_id: stripe_sub.items.data.first.price.id,
                status: stripe_sub.status,
                current_period_end: Time.at(stripe_sub.items.data.first.current_period_end),
                cancel_at_period_end: stripe_sub.cancel_at_period_end,
                canceled_at: stripe_sub.canceled_at ? Time.at(stripe_sub.canceled_at) : nil
              )
              updated += 1
            end
          rescue => e
            errors += 1
            warn "reconcile error for account=#{customer.account_id}: #{e.class}: #{e.message}"
          end
        end

        { checked: checked, updated: updated, errors: errors }
      end

      private

      def fetch_stripe_subscription(known_id)
        return nil unless known_id

        @stripe_client.retrieve_subscription(stripe_subscription_id: known_id)
      rescue Stripe::InvalidRequestError
        nil
      end

      def needs_update?(local, remote)
        return true if local.nil?

        local.status != remote.status ||
          local.cancel_at_period_end != remote.cancel_at_period_end ||
          local.current_period_end.to_i != remote.items.data.first.current_period_end
      end
    end
  end
end
