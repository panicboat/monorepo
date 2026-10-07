module Profile
  module Relations
    class Casts < Profile::DB::Relation
      schema(:"profile__casts", as: :casts, infer: false) do
        attribute :profile_id, Types::String
        attribute :sns_links, Types::Hash
        attribute :age, Types::Integer.optional
        attribute :body_stats, Types::Hash
        attribute :industry, Types::String.optional
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :profile_id
      end
    end
  end
end
