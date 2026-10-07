# frozen_string_literal: true

module Review
  module UseCases
    class CreateEntry
      class CreateError < StandardError; end

      MAX_BODY_LENGTH = 500
      ALLOWED_RATINGS = (1..10).map { |n| n * 0.5 }.freeze

      include Review::Deps[entry_repo: "repositories.entry_repository"]

      def initialize(entry_repo: nil, get_role: nil, **kwargs)
        super(**kwargs.merge(entry_repo: entry_repo).compact)
        @get_role = get_role
      end

      def call(viewer_account_id:, target_account_id:, rating:, body:)
        raise CreateError, "Rating must be one of #{ALLOWED_RATINGS.join(', ')}" unless ALLOWED_RATINGS.include?(rating)
        raise CreateError, "Body too long" if body && body.length > MAX_BODY_LENGTH

        target_role = get_role.call(profile_id: target_account_id)
        raise CreateError, "Target not found" unless target_role
        raise CreateError, "Target must be a cast" unless target_role == 2

        entry_repo.create(
          author_account_id: viewer_account_id,
          target_account_id: target_account_id,
          rating: rating,
          body: body
        )
      end

      private

      def get_role
        @get_role ||= ::Profile::Slice["use_cases.get_role"]
      end
    end
  end
end
