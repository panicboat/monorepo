# frozen_string_literal: true

module Billing
  module Relations
    class Subscriptions < Billing::DB::Relation
      schema(:billing__subscriptions, as: :subscription_records, infer: false) do
        attribute :id, Types::String
        attribute :account_id, Types::String
        attribute :stripe_subscription_id, Types::String
        attribute :stripe_price_id, Types::String
        attribute :status, Types::String
        attribute :current_period_end, Types::Time
        attribute :cancel_at_period_end, Types::Bool
        attribute :canceled_at, Types::Time.optional
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
