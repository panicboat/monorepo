# frozen_string_literal: true

module Karte
  module Relations
    class Reports < Karte::DB::Relation
      schema(:"karte__reports", as: :report_records, infer: false) do
        attribute :id, Types::String
        attribute :entry_id, Types::String
        attribute :reporter_account_id, Types::String
        attribute :reason, Types::String.optional
        attribute :created_at, Types::Time

        primary_key :id
      end
    end
  end
end
