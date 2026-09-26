# frozen_string_literal: true

module Review
  module UseCases
    class CreateEntry
      class CreateError < StandardError; end

      MAX_BODY_LENGTH = 500
      ALLOWED_RATINGS = (1..10).map { |n| n * 0.5 }.freeze

      include Review::Deps[entry_repo: "repositories.entry_repository"]

      def initialize(entry_repo: nil, user_repo: nil, **kwargs)
        super(**kwargs.merge(entry_repo: entry_repo).compact)
        @user_repo = user_repo
      end

      def call(viewer_account_id:, target_account_id:, rating:, body:)
        raise CreateError, "Rating must be one of #{ALLOWED_RATINGS.join(', ')}" unless ALLOWED_RATINGS.include?(rating)
        raise CreateError, "Body too long" if body && body.length > MAX_BODY_LENGTH

        target = user_repo.find_by_id(target_account_id)
        raise CreateError, "Target not found" unless target
        raise CreateError, "Target must be a cast" unless target.role == 2

        entry_repo.create(
          author_account_id: viewer_account_id,
          target_account_id: target_account_id,
          rating: rating,
          body: body
        )
      end

      private

      def user_repo
        @user_repo ||= ::Identity::Slice["repositories.account_repository"]
      end
    end
  end
end
