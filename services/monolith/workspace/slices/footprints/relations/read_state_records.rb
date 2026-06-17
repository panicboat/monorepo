# frozen_string_literal: true

module Footprints
  module Relations
    class ReadStateRecords < Footprints::DB::Relation
      schema(:"footprints__read_states", as: :read_state_records, infer: false) do
        attribute :account_id, Types::String
        attribute :last_read_visit_at, Types::Time
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :account_id
      end
    end
  end
end
