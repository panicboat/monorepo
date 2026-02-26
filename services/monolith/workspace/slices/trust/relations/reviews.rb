# frozen_string_literal: true

module Trust
  module Relations
    class Reviews < Trust::DB::Relation
      schema(:"trust__reviews", as: :reviews, infer: false) do
        attribute :id, Types::String
        attribute :reviewer_id, Types::String
        attribute :reviewee_id, Types::String
        attribute :content, Types::String.optional
        attribute :score, Types::Integer
        attribute :status, Types::String
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id

        associations do
          has_many :review_media, foreign_key: :review_id
        end
      end
    end
  end
end
