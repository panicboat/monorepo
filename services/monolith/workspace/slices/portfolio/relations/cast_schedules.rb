module Portfolio
  module Relations
    class CastSchedules < Portfolio::DB::Relation
      schema(:"portfolio__cast_schedules", as: :cast_schedules, infer: false) do
        attribute :id, Types::String      # UUID
        attribute :cast_id, Types::String  # UUID
        attribute :plan_id, Types::String  # UUID (nullable)
        attribute :date, Types::Date
        attribute :start_time, Types::String
        attribute :end_time, Types::String
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id

        associations do
          belongs_to :cast, foreign_key: :cast_id
          belongs_to :cast_plan, foreign_key: :plan_id
        end
      end
    end
  end
end
