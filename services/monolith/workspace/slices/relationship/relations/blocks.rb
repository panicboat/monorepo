# frozen_string_literal: true

module Relationship
  module Relations
    class Blocks < Relationship::DB::Relation
      schema(:"relationship__blocks", as: :blocks, infer: false) do
        attribute :id, Types::String
        attribute :blocker_id, Types::String
        attribute :blocker_type, Types::String
        attribute :blocked_id, Types::String
        attribute :blocked_type, Types::String
        attribute :created_at, Types::Time

        primary_key :id
      end
    end
  end
end
