# frozen_string_literal: true

module Trust
  module Relations
    class Taggings < Trust::DB::Relation
      schema(:"trust__taggings", as: :taggings, infer: false) do
        attribute :id, Types::String
        attribute :tag_name, Types::String
        attribute :tagger_id, Types::String
        attribute :target_id, Types::String
        attribute :status, Types::String
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
