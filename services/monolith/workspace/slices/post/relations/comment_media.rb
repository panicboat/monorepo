# frozen_string_literal: true

module Post
  module Relations
    class CommentMedia < Post::DB::Relation
      schema(:"post__comment_media", as: :comment_media, infer: false) do
        attribute :id, Types::String
        attribute :comment_id, Types::String
        attribute :media_type, Types::String
        attribute :url, Types::String
        attribute :thumbnail_url, Types::String.optional
        attribute :position, Types::Integer
        attribute :created_at, Types::Time

        primary_key :id

        associations do
          belongs_to :comments, foreign_key: :comment_id
        end
      end
    end
  end
end
