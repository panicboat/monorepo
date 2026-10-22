# frozen_string_literal: true

module Karte
  module Relations
    class Kartes < Karte::DB::Relation
      schema(:"karte__kartes", as: :karte_records, infer: false) do
        attribute :id, Types::String
        attribute :author_account_id, Types::String
        attribute :author_profile_id, Types::String
        attribute :target_profile_id, Types::String
        attribute :rating, Types::Integer.optional
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time
        attribute :last_activity_at, Types::Time
        attribute :last_occurred_on, Types::Date

        primary_key :id
      end
    end
  end
end
