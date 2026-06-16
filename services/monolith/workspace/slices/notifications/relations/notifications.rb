# frozen_string_literal: true

module Notifications
  module Relations
    class Notifications < Notifications::DB::Relation
      schema(:"notifications__notifications", as: :notification_records, infer: false) do
        attribute :id, Types::String
        attribute :recipient_id, Types::String
        attribute :type, Types::String
        attribute :target_resource_id, Types::String
        attribute :actor_count, Types::Integer
        attribute :latest_actor_id, Types::String
        attribute :latest_event_at, Types::Time
        attribute :read_at, Types::Time.optional
        attribute :created_at, Types::Time

        primary_key :id
      end
    end
  end
end
