# frozen_string_literal: true

module Identity
  module Relations
    class Accounts < Identity::DB::Relation
      schema(:identity__accounts, as: :accounts, infer: false) do
        attribute :id, Types::String
        attribute :role, Types::Integer
        attribute :deactivated_at, Types::Time.optional
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
