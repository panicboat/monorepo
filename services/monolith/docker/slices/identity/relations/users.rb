module Identity
  module Relations
    class Users < Identity::DB::Relation
      schema(:"identity__users", as: :users, infer: false) do
        attribute :id, Types::Integer
        attribute :email, Types::String
        attribute :password_hash, Types::String
        attribute :role, Types::String
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
