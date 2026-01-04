module Cast
  module Relations
    class Casts < Cast::DB::Relation
      schema(:"cast__casts", as: :casts, infer: false) do
        attribute :id, Types::Integer
        attribute :user_id, Types::Integer
        attribute :name, Types::String
        attribute :bio, Types::String
        attribute :image_url, Types::String
        attribute :status, Types::String
        attribute :promise_rate, Types::Float
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id

        associations do
          # belongs_to :user, relation: :'identity.relations.users', foreign_key: :user_id
          has_many :cast_plans, foreign_key: :cast_id
        end
      end
    end
  end
end
