# frozen_string_literal: true

module Messaging
  module Relations
    class Threads < Messaging::DB::Relation
      schema(:"messaging__threads", as: :thread_records, infer: false) do
        attribute :id, Types::String
        attribute :account_a, Types::String.optional
        attribute :account_b, Types::String.optional
        attribute :last_message_at, Types::Time.optional
        attribute :created_at, Types::Time

        primary_key :id
      end
    end
  end
end
