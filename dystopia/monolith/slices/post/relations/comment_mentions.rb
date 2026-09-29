# frozen_string_literal: true

module Post
  module Relations
    class CommentMentions < Post::DB::Relation
      schema(:"post__comment_mentions", as: :comment_mentions, infer: false) do
        attribute :id, Types::String
        attribute :comment_id, Types::String
        attribute :account_id, Types::String
        attribute :position, Types::Integer
        attribute :length, Types::Integer
        attribute :created_at, Types::Time

        primary_key :id

        associations do
          belongs_to :comments, foreign_key: :comment_id
        end
      end
    end
  end
end
