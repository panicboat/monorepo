# frozen_string_literal: true

module Trust
  module UseCases
    module Tags
      class DeleteTag
        include Trust::Deps[
          tag_repo: "repositories.tag_repository",
          tagging_repo: "repositories.tagging_repository"
        ]

        def call(id:, identity_id:)
          # Cascade: delete all taggings for this tag
          tagging_repo.delete_by_tag_id(tag_id: id)
          tag_repo.delete(id: id, identity_id: identity_id)
        end
      end
    end
  end
end
