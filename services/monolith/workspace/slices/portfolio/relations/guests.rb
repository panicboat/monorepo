# frozen_string_literal: true

module Portfolio
  module Relations
    class Guests < Portfolio::DB::Relation
      schema(:"portfolio__guests", as: :guests, infer: false) do
        attribute :id, Types::String      # UUID
        attribute :user_id, Types::String # UUID
        attribute :name, Types::String
        attribute :avatar_path, Types::String
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
