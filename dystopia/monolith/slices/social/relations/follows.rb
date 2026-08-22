# frozen_string_literal: true

module Social
  module Relations
    class Follows < Social::DB::Relation
      schema(:"social__follows", as: :follows, infer: false) do
        attribute :id, Types::String
        attribute :follower_id, Types::String
        attribute :followee_id, Types::String
        attribute :status, Types::String
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
