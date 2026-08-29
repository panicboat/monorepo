# frozen_string_literal: true

module Billing
  module Relations
    class StripeEvents < Billing::DB::Relation
      schema(:billing__stripe_events, as: :stripe_event_records, infer: false) do
        attribute :id, Types::String
        attribute :stripe_event_id, Types::String
        attribute :event_type, Types::String
        attribute :payload, Types::Hash
        attribute :processed_at, Types::Time.optional
        attribute :error_message, Types::String.optional
        attribute :received_at, Types::Time

        primary_key :id
      end
    end
  end
end
