# frozen_string_literal: true

module Review
  module Relations
    class Entries < Review::DB::Relation
      schema(:"review__entries", as: :entry_records, infer: false) do
        attribute :id, Types::String
        attribute :author_account_id, Types::String
        attribute :target_account_id, Types::String
        attribute :rating, Types::Decimal
        attribute :body, Types::String.optional
        attribute :hidden, Types::Bool
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
