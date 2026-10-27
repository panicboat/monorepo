# frozen_string_literal: true

module Billing
  module Repositories
    class SubscriptionRepository < Billing::DB::Repo
      def upsert_by_stripe_id(account_id:, stripe_subscription_id:, stripe_price_id:, status:,
                              current_period_end:, cancel_at_period_end:, canceled_at: nil)
        existing = subscription_records.where(stripe_subscription_id: stripe_subscription_id).one
        attrs = {
          account_id: account_id,
          stripe_price_id: stripe_price_id,
          status: status,
          current_period_end: current_period_end,
          cancel_at_period_end: cancel_at_period_end,
          canceled_at: canceled_at,
          updated_at: Time.now
        }
        if existing
          subscription_records.by_pk(existing.id).command(:update).call(attrs)
        else
          subscription_records.command(:create).call(
            attrs.merge(id: SecureRandom.uuid_v7, stripe_subscription_id: stripe_subscription_id)
          )
        end
      end

      def find_by_account_id(account_id)
        newest_first(account_id).limit(1).one
      end

      def list_uncanceled_by_account_id(account_id)
        newest_first(account_id).exclude(status: "canceled").to_a
      end

      def list_reconcilable_by_account_id(account_id)
        newest, *older = newest_first(account_id).to_a
        return [] unless newest

        [newest, *older.reject { |row| row.status == "canceled" }]
      end

      def find_by_stripe_subscription_id(stripe_subscription_id)
        subscription_records.where(stripe_subscription_id: stripe_subscription_id).one
      end

      def find_active_by_account_id(account_id)
        newest_first(account_id)
          .where(status: %w[trialing active])
          .where { current_period_end > Time.now }
          .limit(1)
          .one
      end

      def mark_canceled(stripe_subscription_id:, canceled_at:)
        subscription_records
          .where(stripe_subscription_id: stripe_subscription_id)
          .command(:update)
          .call(status: "canceled", canceled_at: canceled_at, updated_at: Time.now)
      end

      private

      # id breaks created_at ties because uuid_v7 ids are time-ordered.
      def newest_first(account_id)
        subscription_records.where(account_id: account_id).order { [created_at.desc, id.desc] }
      end
    end
  end
end
