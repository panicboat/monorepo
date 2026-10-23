# frozen_string_literal: true

module Notifications
  module Relations
    class PushSubscriptions < ::Notifications::DB::Relation
      schema(:"notifications__push_subscriptions", as: :push_subscription_records, infer: false) do
        attribute :id, Types::String
        attribute :account_id, Types::String
        attribute :profile_id, Types::String
        attribute :endpoint, Types::String
        attribute :p256dh, Types::String
        attribute :auth, Types::String
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
