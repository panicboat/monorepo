# frozen_string_literal: true

module Karte
  module UseCases
    class CreateEntry
      class CreateError < StandardError; end
      class AccessError < StandardError; end

      MAX_BODY_LENGTH = 500

      include Karte::Deps[entry_repo: "repositories.entry_repository"]

      def initialize(entry_repo: nil, user_repo: nil, authorize_cast_access: nil, **kwargs)
        super(**kwargs.merge(entry_repo: entry_repo).compact)
        @user_repo             = user_repo
        @authorize_cast_access = authorize_cast_access
      end

      def call(viewer_account_id:, target_account_id:, rating:, body:)
        raise AccessError, "Karte access required" unless authorize_cast_access.call(viewer_account_id: viewer_account_id)
        raise CreateError, "Rating must be 1..5" unless (1..5).cover?(rating)
        raise CreateError, "Body too long" if body && body.length > MAX_BODY_LENGTH

        target = user_repo.find_by_id(target_account_id)
        raise CreateError, "Target not found" unless target
        raise CreateError, "Target must be a guest" unless target.role == 1

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

      def authorize_cast_access
        @authorize_cast_access ||= Karte::Slice["use_cases.authorize_cast_access"]
      end
    end
  end
end
