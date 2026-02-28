# frozen_string_literal: true

module Offer
  module Relations
    class Schedules < Offer::DB::Relation
      schema(:"offer__schedules", as: :schedules, infer: false) do
        attribute :id, Types::String      # UUID
        attribute :cast_user_id, Types::String  # UUID (FK → casts)
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
