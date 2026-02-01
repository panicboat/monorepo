# frozen_string_literal: true

module Portfolio
  module UseCases
    module Guest
      class GetProfile
        include Deps["repositories.guest_repository"]

        def call(user_id:)
          guest_repository.find_by_user_id(user_id)
        end
      end
    end
  end
end
