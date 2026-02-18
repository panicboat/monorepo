# frozen_string_literal: true

module Trust
  module UseCases
    module Tags
      class ListTags
        include Trust::Deps[tag_repo: "repositories.tag_repository"]

        def call(identity_id:)
          tag_repo.list(identity_id: identity_id)
        end
      end
    end
  end
end
