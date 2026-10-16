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
        attribute :status, Types::String
        attribute :closed_at, Types::Time.optional
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
