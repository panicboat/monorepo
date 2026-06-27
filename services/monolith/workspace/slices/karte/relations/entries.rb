# frozen_string_literal: true

module Karte
  module Relations
    class Entries < Karte::DB::Relation
      schema(:"karte__entries", as: :entry_records, infer: false) do
        attribute :id, Types::String
        attribute :author_account_id, Types::String
        attribute :target_account_id, Types::String
        attribute :rating, Types::Integer
        attribute :body, Types::String.optional
        attribute :reported_count, Types::Integer
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
