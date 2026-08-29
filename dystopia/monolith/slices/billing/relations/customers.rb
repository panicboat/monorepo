# frozen_string_literal: true

module Billing
  module Relations
    class Customers < Billing::DB::Relation
      schema(:billing__customers, as: :customer_records, infer: false) do
        attribute :id, Types::String
        attribute :account_id, Types::String
        attribute :stripe_customer_id, Types::String
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
