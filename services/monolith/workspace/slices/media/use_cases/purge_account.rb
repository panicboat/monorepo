# frozen_string_literal: true

module Media
  module UseCases
    class PurgeAccount
      include Media::Deps[repo: "repositories.media_repository"]

      def call(account_id:)
        repo.delete_by_uploader(account_id)
        nil
      end
    end
  end
end
