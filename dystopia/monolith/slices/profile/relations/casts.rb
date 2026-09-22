module Profile
  module Relations
    class Casts < Profile::DB::Relation
      schema(:"profile__casts", as: :casts, infer: false) do
        attribute :user_id, Types::String  # UUID
        attribute :sns_links, Types::Hash
        attribute :age, Types::Integer.optional
        attribute :body_stats, Types::Hash
        attribute :industry, Types::String.optional
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :user_id

        associations do
          has_many :plans, foreign_key: :cast_user_id
          has_many :cast_gallery_media, foreign_key: :cast_user_id
        end
      end
    end
  end
end
