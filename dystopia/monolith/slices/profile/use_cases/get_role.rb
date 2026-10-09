# frozen_string_literal: true

module Profile
  module UseCases
    class GetRole
      include Deps["repositories.profile_repository"]

      def call(profile_id:)
        profile_repository.role_of(profile_id)
      end
    end
  end
end
