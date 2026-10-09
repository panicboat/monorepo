# frozen_string_literal: true

module Schedule
  module UseCases
    class PurgeProfile
      include Schedule::Deps[schedule_repo: "repositories.schedule_repository"]

      def call(profile_id:)
        schedule_repo.delete_by_profile(profile_id)
        nil
      end
    end
  end
end
