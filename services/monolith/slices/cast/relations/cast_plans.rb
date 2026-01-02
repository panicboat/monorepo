module Cast
  module Relations
    class CastPlans < Cast::DB::Relation
      schema(:"cast__cast_plans", as: :cast_plans, infer: false) do
        attribute :id, Types::Integer
        attribute :cast_id, Types::Integer
        attribute :name, Types::String
        attribute :price, Types::Integer
        attribute :duration_minutes, Types::Integer
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id

        associations do
          belongs_to :cast, foreign_key: :cast_id
        end
      end
    end
  end
end
