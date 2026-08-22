# frozen_string_literal: true

module Bookmarks
  module Relations
    class Bookmarks < Bookmarks::DB::Relation
      schema(:"bookmarks__bookmarks", as: :bookmark_records, infer: false) do
        attribute :id, Types::String
        attribute :account_id, Types::String
        attribute :post_id, Types::String
        attribute :created_at, Types::Time

        primary_key :id
      end
    end
  end
end
