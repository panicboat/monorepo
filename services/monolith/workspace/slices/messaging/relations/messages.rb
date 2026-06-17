# frozen_string_literal: true

module Messaging
  module Relations
    class Messages < Messaging::DB::Relation
      schema(:"messaging__messages", as: :message_records, infer: false) do
        attribute :id, Types::String
        attribute :thread_id, Types::String
        attribute :sender_id, Types::String
        attribute :content, Types::String
        attribute :created_at, Types::Time

        primary_key :id
      end
    end
  end
end
