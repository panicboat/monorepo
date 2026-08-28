# frozen_string_literal: true

module Billing
  module Repositories
    class StripeEventRepository < Billing::DB::Repo
      def find_by_stripe_event_id(stripe_event_id)
        stripe_event_records.where(stripe_event_id: stripe_event_id).one
      end

      def insert_received(stripe_event_id:, event_type:, payload:)
        stripe_event_records.command(:create).call(
          id: SecureRandom.uuid_v7,
          stripe_event_id: stripe_event_id,
          event_type: event_type,
          payload: Sequel.pg_jsonb(payload)
        )
      rescue ROM::SQL::UniqueConstraintError => error
        raise error.original_exception
      end

      def mark_processed(stripe_event_id:)
        stripe_event_records
          .where(stripe_event_id: stripe_event_id)
          .command(:update)
          .call(processed_at: Time.now, error_message: nil)
      end

      def mark_failed(stripe_event_id:, error_message:)
        stripe_event_records
          .where(stripe_event_id: stripe_event_id)
          .command(:update)
          .call(error_message: error_message)
      end
    end
  end
end
