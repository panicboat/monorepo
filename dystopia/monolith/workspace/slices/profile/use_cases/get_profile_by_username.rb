# frozen_string_literal: true

module Profile
  module UseCases
    class GetProfileByUsername
      include Deps["repositories.profile_repository"]

      def call(username:)
        profile_repository.find_by_username(username)
      end
    end
  end
end
