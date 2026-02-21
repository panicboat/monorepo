# frozen_string_literal: true

module Trust
  module UseCases
    module Taggings
      class ListMyTagNames
        include Trust::Deps[
          tagging_repo: "repositories.tagging_repository"
        ]

        def call(tagger_id:)
          tagging_repo.list_tagger_tag_names(tagger_id: tagger_id)
        end
      end
    end
  end
end
