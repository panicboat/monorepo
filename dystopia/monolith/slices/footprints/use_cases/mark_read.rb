# frozen_string_literal: true

module Footprints
  module UseCases
    class MarkRead
      include Footprints::Deps[footprints_repo: "repositories.footprints_repository"]

      def call(profile_id:)
        footprints_repo.set_last_read_now(profile_id: profile_id)
      end
    end
  end
end
