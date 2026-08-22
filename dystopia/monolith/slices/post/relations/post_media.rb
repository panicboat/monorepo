# frozen_string_literal: true

module Post
  module Relations
    class PostMedia < Post::DB::Relation
      schema(:"post__post_media", as: :post_media, infer: false) do
        attribute :id, Types::String
        attribute :post_id, Types::String
        attribute :media_id, Types::String.optional
        attribute :media_type, Types::String
        attribute :position, Types::Integer
        attribute :created_at, Types::Time

        primary_key :id

        associations do
          belongs_to :posts, foreign_key: :post_id
        end
      end
    end
  end
end
