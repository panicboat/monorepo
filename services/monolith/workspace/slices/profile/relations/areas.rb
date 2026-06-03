module Profile
  module Relations
    class Areas < Profile::DB::Relation
      schema(:"portfolio__areas", as: :areas, infer: false) do
        attribute :id, Types::String
        attribute :prefecture, Types::String
        attribute :name, Types::String
        attribute :code, Types::String
        attribute :region, Types::String.optional
        attribute :sort_order, Types::Integer
        attribute :active, Types::Bool
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id

        associations do
          has_many :cast_areas, foreign_key: :area_id
          has_many :profile_areas, foreign_key: :area_id
        end
      end
    end
  end
end
