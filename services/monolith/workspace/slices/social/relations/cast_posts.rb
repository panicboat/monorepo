# frozen_string_literal: true

module Social
  module Relations
    class CastPosts < Social::DB::Relation
      schema(:"post__posts", as: :cast_posts, infer: false) do
        attribute :id, Types::String
        attribute :cast_id, Types::String
        attribute :content, Types::String
        attribute :visibility, Types::String
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id

        associations do
          has_many :cast_post_media, foreign_key: :post_id
          has_many :cast_post_hashtags, foreign_key: :post_id
        end
      end
    end
  end
end
