# frozen_string_literal: true

module Trust
  module UseCases
    module Taggings
      class ListTargetTags
        include Trust::Deps[
          tagging_repo: "repositories.tagging_repository"
        ]

        def call(target_id:)
          taggings = tagging_repo.list_by_target(target_id: target_id)

          taggings.map do |tagging|
            {
              id: tagging.id,
              tag_name: tagging.tag_name,
              tagger_id: tagging.tagger_id,
              created_at: tagging.created_at
            }
          end
        end
      end
    end
  end
end
