# frozen_string_literal: true

module Media
  module Relations
    class Files < Media::DB::Relation
      schema(:"media__files", as: :files, infer: false) do
        attribute :id, Types::String
        attribute :media_type, Types::String
        attribute :url, Types::String
        attribute :thumbnail_url, Types::String.optional
        attribute :filename, Types::String.optional
        attribute :content_type, Types::String.optional
        attribute :size_bytes, Types::Integer.optional
        attribute :media_key, Types::String.optional
        attribute :thumbnail_key, Types::String.optional
        attribute :created_at, Types::Time

        primary_key :id
      end
    end
  end
end
