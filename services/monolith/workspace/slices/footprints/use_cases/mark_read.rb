# frozen_string_literal: true

module Footprints
  module UseCases
    # Sets account_id's last_read_visit_at to now(), upserting the read_state row.
    class MarkRead
      include Footprints::Deps[footprints_repo: "repositories.footprints_repository"]

      def call(account_id:)
        footprints_repo.set_last_read_now(account_id: account_id)
      end
    end
  end
end
