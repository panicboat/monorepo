# frozen_string_literal: true

module Post
  module Relations
    class Hashtags < Post::DB::Relation
      schema(:"post__hashtags", as: :hashtags, infer: false) do
        attribute :id, Types::String
        attribute :post_id, Types::String
        attribute :tag, Types::String
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
