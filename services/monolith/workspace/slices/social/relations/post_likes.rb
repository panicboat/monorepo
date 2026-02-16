# frozen_string_literal: true

module Social
  module Relations
    class PostLikes < Social::DB::Relation
      schema(:"post__likes", as: :post_likes, infer: false) do
        attribute :id, Types::String
        attribute :post_id, Types::String
        attribute :guest_id, Types::String
        attribute :created_at, Types::Time

        primary_key :id

        associations do
          belongs_to :cast_posts, foreign_key: :post_id
        end
      end
    end
  end
end
