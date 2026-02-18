# frozen_string_literal: true

module Portfolio
  module Relations
    class CastGalleryMedia < Portfolio::DB::Relation
      schema(:"portfolio__cast_gallery_media", as: :cast_gallery_media, infer: false) do
        attribute :id, Types::String
        attribute :cast_id, Types::String
        attribute :media_id, Types::String
        attribute :position, Types::Integer
        attribute :created_at, Types::Time

        primary_key :id

        associations do
          belongs_to :casts, foreign_key: :cast_id
        end
      end
    end
  end
end
