# frozen_string_literal: true

module Social
  module Relations
    class CastPostMedia < Social::DB::Relation
      schema(:"post__post_media", as: :cast_post_media, infer: false) do
        attribute :id, Types::String
        attribute :post_id, Types::String
        attribute :media_type, Types::String
        attribute :url, Types::String
        attribute :thumbnail_url, Types::String.optional
        attribute :position, Types::Integer
        attribute :created_at, Types::Time

        primary_key :id

        associations do
          belongs_to :cast_posts, foreign_key: :post_id
        end
      end
    end
  end
end
