# frozen_string_literal: true

module Profile
  module UseCases
    class PurgeProfile
      include Profile::Deps[
        profile_repo: "repositories.profile_repository",
        cast_repo: "repositories.cast_repository"
      ]

      def initialize(slice_purges: nil, **kwargs)
        super(**kwargs)
        @slice_purges = slice_purges
      end

      # Deletes the profile row last so that a failed slice leaves the profile in place and the call can be repeated.
      def call(profile_id:)
        slice_purges.each { |purge| purge.call(profile_id: profile_id) }
        cast_repo.delete_by_profile_ids([profile_id])
        profile_repo.delete(profile_id)
        nil
      end

      private

      def slice_purges
        @slice_purges ||= [
          ::Notifications::Slice["use_cases.purge_profile"],
          ::Footprints::Slice["use_cases.purge_profile"],
          ::Bookmarks::Slice["use_cases.purge_profile"],
          ::Messaging::Slice["use_cases.purge_profile"],
          ::Social::Slice["use_cases.purge_profile"],
          ::Review::Slice["use_cases.purge_profile"],
          ::Post::Slice["use_cases.purge_profile"],
          ::Media::Slice["use_cases.purge_profile"],
          ::Schedule::Slice["use_cases.purge_profile"]
        ]
      end
    end
  end
end
