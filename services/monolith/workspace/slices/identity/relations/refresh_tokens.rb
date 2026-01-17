module Identity
  module Relations
    class RefreshTokens < Identity::DB::Relation
      schema(:"identity__refresh_tokens", as: :refresh_tokens, infer: false) do
        attribute :id, Types::String
        attribute :user_id, Types::String
        attribute :token, Types::String
        attribute :expires_at, Types::Time
        attribute :created_at, Types::Time

        primary_key :id

        associations do
          belongs_to :users, as: :user, foreign_key: :user_id, relation: :users
        end
      end
    end
  end
end
