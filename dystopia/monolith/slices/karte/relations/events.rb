# frozen_string_literal: true

module Karte
  module Relations
    class Events < Karte::DB::Relation
      schema(:"karte__events", as: :event_records, infer: false) do
        attribute :id, Types::String
        attribute :entry_id, Types::String
        attribute :stage, Types::String
        attribute :outcome, Types::String
        attribute :tags, ROM::SQL::Postgres::Types::JSONB
        attribute :note, Types::String
        attribute :occurred_on, Types::Date
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
