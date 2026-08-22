# frozen_string_literal: true

module Identity
  module UseCases
    module User
      class GetProfile
        include Identity::Deps[repo: "repositories.user_repository"]

        def call(user_id:)
          user = repo.users.by_pk(user_id).one

          return nil unless user

          { id: user.id, phone_number: user.phone_number, role: user.role }
        end
      end
    end
  end
end
