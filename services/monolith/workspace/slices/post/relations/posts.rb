# frozen_string_literal: true

module Post
  module Relations
    class Posts < Post::DB::Relation
      schema(:"post__posts", as: :posts, infer: false) do
        attribute :id, Types::String
        attribute :cast_user_id, Types::String
        attribute :content, Types::String
        attribute :visibility, Types::String
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id

        associations do
          has_many :post_media, foreign_key: :post_id
          has_many :hashtags, foreign_key: :post_id
        end
      end
    end
  end
end
