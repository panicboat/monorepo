# frozen_string_literal: true

module Media
  module UseCases
    class GetMedia
      include Media::Deps[repo: "repositories.media_repository"]

      def call(id:)
        repo.find_by_id(id)
      end
    end
  end
end
