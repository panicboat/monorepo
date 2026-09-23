# frozen_string_literal: true

module Karte
  module Relations
    class Access < Karte::DB::Relation
      schema(:"karte__access", as: :access_records, infer: false) do
        attribute :account_id, Types::String
        attribute :granted_at, Types::Time

        primary_key :account_id
      end
    end
  end
end
