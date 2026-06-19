module Profile
  module Relations
    class Genres < Profile::DB::Relation
      schema(:"profile__genres", as: :genres, infer: false) do
        attribute :id, Types::String
        attribute :name, Types::String
        attribute :slug, Types::String
        attribute :display_order, Types::Integer
        attribute :is_active, Types::Bool
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id

        associations do
          has_many :cast_genres, foreign_key: :genre_id
        end
      end
    end
  end
end
