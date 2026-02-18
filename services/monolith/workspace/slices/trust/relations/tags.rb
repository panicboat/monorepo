# frozen_string_literal: true

module Trust
  module Relations
    class Tags < Trust::DB::Relation
      schema(:"trust__tags", as: :tags, infer: false) do
        attribute :id, Types::String
        attribute :identity_id, Types::String
        attribute :name, Types::String
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
