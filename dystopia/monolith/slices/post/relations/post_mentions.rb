# frozen_string_literal: true

module Post
  module Relations
    class PostMentions < Post::DB::Relation
      schema(:"post__post_mentions", as: :post_mentions, infer: false) do
        attribute :id, Types::String
        attribute :post_id, Types::String
        attribute :account_id, Types::String
        attribute :position, Types::Integer
        attribute :length, Types::Integer
        attribute :created_at, Types::Time

        primary_key :id

        associations do
          belongs_to :posts, foreign_key: :post_id
        end
      end
    end
  end
end
