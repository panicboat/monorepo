# frozen_string_literal: true

module Notifications
  module Relations
    class Preferences < ::Notifications::DB::Relation
      schema(:"notifications__preferences", as: :preference_records, infer: false) do
        attribute :profile_id, Types::String
        attribute :comment, Types::Bool
        attribute :like, Types::Bool
        attribute :reply, Types::Bool
        attribute :follow, Types::Bool
        attribute :mention, Types::Bool
        attribute :quote, Types::Bool
        attribute :message, Types::Bool
        attribute :footprint_unread_badge, Types::Bool
        attribute :footprints_record_my_visits, Types::Bool
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :profile_id
      end
    end
  end
end
