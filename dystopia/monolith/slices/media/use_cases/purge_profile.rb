# frozen_string_literal: true

module Media
  module UseCases
    class PurgeProfile
      include Media::Deps[repo: "repositories.media_repository"]

      def call(profile_id:)
        repo.delete_by_uploader(profile_id)
        nil
      end
    end
  end
end
