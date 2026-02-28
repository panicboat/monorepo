# frozen_string_literal: true

module Portfolio
  module Relations
    class Guests < Portfolio::DB::Relation
      schema(:"portfolio__guests", as: :guests, infer: false) do
        attribute :user_id, Types::String # UUID
        attribute :name, Types::String
        attribute :avatar_media_id, Types::String
        attribute :tagline, Types::String
        attribute :bio, Types::String
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :user_id
      end
    end
  end
end
