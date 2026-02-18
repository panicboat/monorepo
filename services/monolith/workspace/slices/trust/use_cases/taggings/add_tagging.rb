# frozen_string_literal: true

module Trust
  module UseCases
    module Taggings
      class AddTagging
        include Trust::Deps[
          tag_repo: "repositories.tag_repository",
          tagging_repo: "repositories.tagging_repository"
        ]

        def call(tag_id:, tagger_id:, target_id:, role:)
          tag = tag_repo.find_by_id(id: tag_id)
          return { success: false, error: :tag_not_found } unless tag
          return { success: false, error: :not_owner } unless tag.identity_id == tagger_id

          # Cast tags are auto-approved, Guest tags need approval
          status = role == :cast ? "approved" : "pending"

          tagging_repo.add(
            tag_id: tag_id,
            tagger_id: tagger_id,
            target_id: target_id,
            status: status
          )
        end
      end
    end
  end
end
