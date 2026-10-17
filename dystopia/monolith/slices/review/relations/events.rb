# frozen_string_literal: true

module Review
  module Relations
    class Events < Review::DB::Relation
      schema(:"review__events", as: :event_records, infer: false) do
        attribute :id, Types::String
        attribute :review_id, Types::String
        attribute :stage, Types::String
        attribute :outcome, Types::String
        attribute :tags, Types::PG::Array("text", Types::String)
        attribute :note, Types::String.optional
        attribute :occurred_on, Types::Date
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
