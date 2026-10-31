# frozen_string_literal: true

module Profile
  module UseCases
    class ListMediaIdsInUse
      include Deps["repositories.profile_repository"]

      def call(ids:)
        return [] if ids.nil? || ids.empty?

        profile_repository.media_ids_in_use(ids)
      end
    end
  end
end
