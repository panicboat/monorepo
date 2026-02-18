# frozen_string_literal: true

module Trust
  module UseCases
    module Taggings
      class ListPendingTaggings
        include Trust::Deps[
          tagging_repo: "repositories.tagging_repository",
          tag_repo: "repositories.tag_repository"
        ]

        def call(target_id:, limit: 20, cursor: nil)
          result = tagging_repo.list_pending_by_target(
            target_id: target_id,
            limit: limit,
            cursor: cursor
          )

          taggings = result[:taggings].map do |tagging|
            tag = tag_repo.find_by_id(id: tagging.tag_id)
            {
              id: tagging.id,
              tag_name: tag&.name || "",
              tagger_id: tagging.tagger_id,
              created_at: tagging.created_at
            }
          end

          {
            taggings: taggings,
            has_more: result[:has_more]
          }
        end
      end
    end
  end
end
