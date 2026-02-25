# frozen_string_literal: true

module Trust
  module Relations
    class ReviewMedia < Trust::DB::Relation
      schema(:"trust__review_media", as: :review_media, infer: false) do
        attribute :id, Types::String
        attribute :review_id, Types::String
        attribute :media_id, Types::String.optional
        attribute :media_type, Types::String
        attribute :position, Types::Integer
        attribute :created_at, Types::Time

        primary_key :id

        associations do
          belongs_to :reviews, foreign_key: :review_id
        end
      end
    end
  end
end
