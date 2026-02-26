# frozen_string_literal: true

module Post
  module Relations
    class Likes < Post::DB::Relation
      schema(:"post__likes", as: :likes, infer: false) do
        attribute :id, Types::String
        attribute :post_id, Types::String
        attribute :guest_user_id, Types::String
        attribute :created_at, Types::Time

        primary_key :id

        associations do
          belongs_to :posts, foreign_key: :post_id
        end
      end
    end
  end
end
