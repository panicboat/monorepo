# frozen_string_literal: true

module Messaging
  module UseCases
    class PurgeAccount
      include Messaging::Deps[repo: "repositories.messaging_repository"]

      def call(account_id:)
        repo.delete_read_states_by_account(account_id)
        repo.null_out_sender(account_id)
        repo.null_out_thread_participants(account_id)
        nil
      end
    end
  end
end
