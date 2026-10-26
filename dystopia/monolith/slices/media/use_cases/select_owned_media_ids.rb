# frozen_string_literal: true

module Media
  module UseCases
    class SelectOwnedMediaIds
      include Media::Deps[repo: "repositories.media_repository"]

      def call(profile_id:, ids:)
        return [] if ids.nil? || ids.empty?

        repo.ids_uploaded_by(profile_id: profile_id, ids: ids)
      end
    end
  end
end
