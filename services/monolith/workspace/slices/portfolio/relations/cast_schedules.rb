# frozen_string_literal: true

# Read-only relation for online status queries.
# Write operations should use Offer::Repositories::OfferRepository.

module Portfolio
  module Relations
    class CastSchedules < Portfolio::DB::Relation
      schema(:"offer__cast_schedules", as: :cast_schedules, infer: false) do
        attribute :id, Types::String
        attribute :cast_id, Types::String
        attribute :date, Types::Date
        attribute :start_time, Types::String
        attribute :end_time, Types::String
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
