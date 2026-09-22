module Profile
  module Relations
    class Profiles < Profile::DB::Relation
      schema(:"profile__profiles", as: :profiles, infer: false) do
        attribute :account_id, Types::String       # UUID, PK = identity.Account
        attribute :username, Types::String.optional
        attribute :display_name, Types::String
        attribute :bio, Types::String.optional
        attribute :avatar_media_id, Types::String.optional
        attribute :cover_media_id, Types::String.optional
        attribute :website, Types::String.optional
        attribute :prefecture, Types::String.optional
        attribute :is_private, Types::Bool
        attribute :registered_at, Types::Time.optional
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :account_id

        associations do
          has_many :profile_areas, foreign_key: :profile_id
        end
      end
    end
  end
end
