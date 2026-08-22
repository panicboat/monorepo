# frozen_string_literal: true

module Media
  module UseCases
    class GetMediaBatch
      include Media::Deps[repo: "repositories.media_repository"]

      def call(ids:)
        return [] if ids.nil? || ids.empty?

        repo.find_by_ids(ids)
      end
    end
  end
end
