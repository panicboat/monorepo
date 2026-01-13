module Identity
  module Relations
    class Users < Identity::DB::Relation
      schema(:"identity__users", as: :users, infer: false) do
        attribute :id, Types::String
        attribute :phone_number, Types::String
        attribute :password_digest, Types::String
        attribute :role, Types::Integer
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
