# frozen_string_literal: true

module Billing
  module Repositories
    class CustomerRepository < Billing::DB::Repo
      def upsert_by_account_id(account_id:, stripe_customer_id:)
        existing = customer_records.where(account_id: account_id).one
        if existing
          customer_records.by_pk(existing.id).command(:update).call(
            stripe_customer_id: stripe_customer_id,
            updated_at: Time.now
          )
        else
          customer_records.command(:create).call(
            id: SecureRandom.uuid_v7,
            account_id: account_id,
            stripe_customer_id: stripe_customer_id
          )
        end
      end

      def find_by_account_id(account_id)
        customer_records.where(account_id: account_id).one
      end

      def find_by_stripe_customer_id(stripe_customer_id)
        customer_records.where(stripe_customer_id: stripe_customer_id).one
      end

      def all
        customer_records.to_a
      end
    end
  end
end
