module Portfolio
  module Relations
    class Casts < Portfolio::DB::Relation
      schema(:"portfolio__casts", as: :casts, infer: false) do
        attribute :user_id, Types::String  # UUID
        attribute :name, Types::String
        attribute :bio, Types::String
        attribute :tagline, Types::String
        attribute :default_schedules, Types::Any  # JSONB array
        attribute :visibility, Types::String
        attribute :social_links, Types::Hash
        attribute :age, Types::Integer
        attribute :height, Types::Integer
        attribute :blood_type, Types::String
        attribute :three_sizes, Types::Hash
        attribute :tags, Types::Any
        attribute :slug, Types::String
        attribute :profile_media_id, Types::String.optional
        attribute :avatar_media_id, Types::String.optional
        attribute :registered_at, Types::Time
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :user_id

        associations do
          # belongs_to :user, relation: :'identity.relations.users', foreign_key: :user_id
          has_many :plans, foreign_key: :cast_user_id
          has_many :cast_areas, foreign_key: :cast_user_id
          has_many :cast_gallery_media, foreign_key: :cast_user_id
          # Note: schedules association moved to Offer slice
        end
      end
    end
  end
end
