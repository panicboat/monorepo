# frozen_string_literal: true

module Messaging
  module Relations
    class ReadStates < Messaging::DB::Relation
      schema(:"messaging__read_states", as: :read_state_records, infer: false) do
        attribute :thread_id, Types::String
        attribute :account_id, Types::String
        attribute :last_read_message_id, Types::String.optional
        attribute :updated_at, Types::Time

        primary_key :thread_id, :account_id
      end
    end
  end
end
