module Portfolio
  module Relations
    class CastPlans < Portfolio::DB::Relation
      schema(:"portfolio__cast_plans", as: :cast_plans, infer: false) do
        attribute :id, Types::String      # UUID
        attribute :cast_id, Types::String  # UUID
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
