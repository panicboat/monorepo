module Portfolio
  module Relations
    class Casts < Portfolio::DB::Relation
      schema(:"portfolio__casts", as: :casts, infer: false) do
        attribute :id, Types::String      # UUID
        attribute :user_id, Types::String  # UUID
        attribute :name, Types::String
        attribute :bio, Types::String
        attribute :image_path, Types::String
        attribute :tagline, Types::String
        attribute :service_category, Types::String
        attribute :location_type, Types::String
        attribute :area, Types::String
        attribute :default_schedule_start, Types::String
        attribute :default_schedule_end, Types::String
        attribute :visibility, Types::String
        attribute :promise_rate, Types::Float
        attribute :images, Types::Array(Types::String)
        attribute :social_links, Types::Hash
        attribute :age, Types::Integer
        attribute :height, Types::Integer
        attribute :blood_type, Types::String
        attribute :three_sizes, Types::Hash
        attribute :tags, Types::Any
        attribute :avatar_path, Types::String
        attribute :handle, Types::String
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id

        associations do
          # belongs_to :user, relation: :'identity.relations.users', foreign_key: :user_id
          has_many :cast_plans, foreign_key: :cast_id
          has_many :cast_schedules, foreign_key: :cast_id
          has_many :cast_areas, foreign_key: :cast_id
        end
      end
    end
  end
end
