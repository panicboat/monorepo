module Profile
  module Relations
    class ProfileAreas < Profile::DB::Relation
      schema(:"profile__profile_areas", as: :profile_areas, infer: false) do
        attribute :profile_id, Types::String
        attribute :area_id, Types::String
        attribute :created_at, Types::Time

        associations do
          belongs_to :profile, foreign_key: :profile_id
          belongs_to :area, foreign_key: :area_id
        end
      end
    end
  end
end
