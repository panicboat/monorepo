# frozen_string_literal: true

module Social
  module Relations
    class CastFollows < Social::DB::Relation
      schema(:"relationship__follows", as: :cast_follows, infer: false) do
        attribute :id, Types::String
        attribute :cast_id, Types::String
        attribute :guest_id, Types::String
        attribute :status, Types::String
        attribute :created_at, Types::Time

        primary_key :id
      end
    end
  end
end
