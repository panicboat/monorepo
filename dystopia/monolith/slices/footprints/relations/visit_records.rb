# frozen_string_literal: true

module Footprints
  module Relations
    class VisitRecords < Footprints::DB::Relation
      schema(:"footprints__visits", as: :visit_records, infer: false) do
        attribute :id, Types::String
        attribute :visitor_id, Types::String
        attribute :visited_id, Types::String
        attribute :first_visited_at, Types::Time
        attribute :last_visited_at, Types::Time
        attribute :visit_count, Types::Integer
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
