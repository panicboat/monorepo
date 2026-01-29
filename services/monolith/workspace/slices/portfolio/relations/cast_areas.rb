module Portfolio
  module Relations
    class CastAreas < Portfolio::DB::Relation
      schema(:"portfolio__cast_areas", as: :cast_areas, infer: false) do
        attribute :cast_id, Types::String
        attribute :area_id, Types::String
        attribute :created_at, Types::Time

        associations do
          belongs_to :cast, foreign_key: :cast_id
          belongs_to :area, foreign_key: :area_id
        end
      end
    end
  end
end
