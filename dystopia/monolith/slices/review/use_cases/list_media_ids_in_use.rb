# frozen_string_literal: true

module Review
  module UseCases
    class ListMediaIdsInUse
      include Review::Deps["repositories.event_repository"]

      def call(ids:)
        return [] if ids.nil? || ids.empty?

        event_repository.attached_media_ids(ids)
      end
    end
  end
end
