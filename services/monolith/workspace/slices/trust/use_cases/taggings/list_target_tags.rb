# frozen_string_literal: true

module Trust
  module UseCases
    module Taggings
      class ListTargetTags
        include Trust::Deps[
          tagging_repo: "repositories.tagging_repository",
          tag_repo: "repositories.tag_repository"
        ]

        def call(target_id:)
          taggings = tagging_repo.list_by_target(target_id: target_id)

          taggings.map do |tagging|
            tag = tag_repo.find_by_id(id: tagging.tag_id)
            {
              id: tagging.id,
              tag_name: tag&.name || "",
              tagger_id: tagging.tagger_id,
              status: tagging.status,
              created_at: tagging.created_at
            }
          end
        end
      end
    end
  end
end
