# frozen_string_literal: true

module Offer
  module Relations
    class CastPlans < Offer::DB::Relation
      schema(:"offer__cast_plans", as: :cast_plans, infer: false) do
        attribute :id, Types::String      # UUID
        attribute :cast_id, Types::String  # UUID (FK → casts)
        attribute :name, Types::String
        attribute :price, Types::Integer
        attribute :duration_minutes, Types::Integer
        attribute :is_recommended, Types::Bool
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
