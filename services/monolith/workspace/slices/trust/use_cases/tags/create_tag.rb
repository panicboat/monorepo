# frozen_string_literal: true

module Trust
  module UseCases
    module Tags
      class CreateTag
        include Trust::Deps[tag_repo: "repositories.tag_repository"]

        def call(identity_id:, name:)
          tag_repo.create(identity_id: identity_id, name: name.strip)
        end
      end
    end
  end
end
