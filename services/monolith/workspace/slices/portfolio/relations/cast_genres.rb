module Portfolio
  module Relations
    class CastGenres < Portfolio::DB::Relation
      schema(:"portfolio__cast_genres", as: :cast_genres, infer: false) do
        attribute :id, Types::String
        attribute :cast_id, Types::String
        attribute :genre_id, Types::String
        attribute :created_at, Types::Time

        primary_key :id

        associations do
          belongs_to :cast, foreign_key: :cast_id
          belongs_to :genre, foreign_key: :genre_id
        end
      end
    end
  end
end
