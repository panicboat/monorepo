# frozen_string_literal: true

module Relationship
  module Relations
    class Favorites < Relationship::DB::Relation
      schema(:"relationship__favorites", as: :favorites, infer: false) do
        attribute :id, Types::String
        attribute :cast_user_id, Types::String
        attribute :guest_user_id, Types::String
        attribute :created_at, Types::Time

        primary_key :id
      end
    end
  end
end
