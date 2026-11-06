# frozen_string_literal: true

module Review
  module Relations
    class EventMedia < Review::DB::Relation
      schema(:"review__event_media", as: :event_media_records, infer: false) do
        attribute :id, Types::String
        attribute :event_id, Types::String
        attribute :media_id, Types::String
        attribute :media_type, Types::String
        attribute :position, Types::Integer
        attribute :created_at, Types::Time

        primary_key :id
      end
    end
  end
end
