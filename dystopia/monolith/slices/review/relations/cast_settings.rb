# frozen_string_literal: true

module Review
  module Relations
    class CastSettings < Review::DB::Relation
      schema(:"review__cast_settings", as: :cast_settings_records, infer: false) do
        attribute :account_id, Types::String
        attribute :reviews_visible, Types::Bool
        attribute :updated_at, Types::Time

        primary_key :account_id
      end
    end
  end
end
