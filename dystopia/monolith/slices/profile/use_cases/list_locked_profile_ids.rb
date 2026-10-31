# frozen_string_literal: true

module Profile
  module UseCases
    class ListLockedProfileIds
      include Deps["repositories.profile_repository"]

      def call(profile_ids:)
        profile_repository.visible_locked_ids(profile_ids.compact.map(&:to_s).uniq)
      end
    end
  end
end
