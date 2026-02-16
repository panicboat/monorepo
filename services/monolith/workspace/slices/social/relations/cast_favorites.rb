# frozen_string_literal: true

module Social
  module Relations
    class CastFavorites < Social::DB::Relation
      schema(:"relationship__favorites", as: :cast_favorites, infer: false) do
        attribute :id, Types::String
        attribute :cast_id, Types::String
        attribute :guest_id, Types::String
        attribute :created_at, Types::Time

        primary_key :id
      end
    end
  end
end
