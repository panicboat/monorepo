# frozen_string_literal: true

# Read-only relation for online status queries.
# Write operations were removed in 2026-05-29 commerce dimension drop.

module Profile
  module Relations
    class Schedules < Profile::DB::Relation
      schema(:"offer__schedules", as: :schedules, infer: false) do
        attribute :id, Types::String
        attribute :cast_user_id, Types::String
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
