# frozen_string_literal: true

module Messaging
  module UseCases
    class PurgeProfile
      include Messaging::Deps[repo: "repositories.messaging_repository"]

      def call(profile_id:)
        repo.delete_read_states_by_profile(profile_id)
        repo.null_out_sender(profile_id)
        repo.null_out_thread_participants(profile_id)
        nil
      end
    end
  end
end
