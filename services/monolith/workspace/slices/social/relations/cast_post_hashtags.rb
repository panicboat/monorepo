# frozen_string_literal: true

module Social
  module Relations
    class CastPostHashtags < Social::DB::Relation
      schema(:"social__cast_post_hashtags", as: :cast_post_hashtags, infer: false) do
        attribute :id, Types::String
        attribute :post_id, Types::String
        attribute :tag, Types::String
        attribute :position, Types::Integer
        attribute :created_at, Types::Time

        primary_key :id

        associations do
          belongs_to :cast_post, foreign_key: :post_id
        end
      end
    end
  end
end
