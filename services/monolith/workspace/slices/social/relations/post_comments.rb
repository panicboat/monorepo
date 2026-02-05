# frozen_string_literal: true

module Social
  module Relations
    class PostComments < Social::DB::Relation
      schema(:"social__post_comments", as: :post_comments, infer: false) do
        attribute :id, Types::String
        attribute :post_id, Types::String
        attribute :parent_id, Types::String.optional
        attribute :user_id, Types::String
        attribute :content, Types::String
        attribute :replies_count, Types::Integer
        attribute :created_at, Types::Time

        primary_key :id

        associations do
          belongs_to :cast_posts, foreign_key: :post_id
          belongs_to :post_comments, foreign_key: :parent_id, as: :parent
          has_many :comment_media, foreign_key: :comment_id
          has_many :post_comments, foreign_key: :parent_id, as: :replies
        end
      end
    end
  end
end
