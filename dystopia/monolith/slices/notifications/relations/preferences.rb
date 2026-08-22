# frozen_string_literal: true

module Notifications
  module Relations
    # NB: top-level `::Notifications` reference avoids resolving as
    # `Notifications::Relations::Notifications` when defined inside this module.
    class Preferences < ::Notifications::DB::Relation
      schema(:"notifications__preferences", as: :preference_records, infer: false) do
        attribute :account_id, Types::String
        attribute :push_enabled, Types::Bool
        attribute :post, Types::Bool
        attribute :like, Types::Bool
        attribute :repost, Types::Bool
        attribute :quote, Types::Bool
        attribute :reply, Types::Bool
        attribute :follow, Types::Bool
        attribute :mention, Types::Bool
        attribute :message, Types::Bool
        attribute :oshi, Types::Bool
        attribute :footprint_unread_badge, Types::Bool
        attribute :footprints_record_my_visits, Types::Bool
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :account_id
      end
    end
  end
end
