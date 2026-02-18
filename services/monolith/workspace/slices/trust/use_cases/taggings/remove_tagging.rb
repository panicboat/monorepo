# frozen_string_literal: true

module Trust
  module UseCases
    module Taggings
      class RemoveTagging
        include Trust::Deps[tagging_repo: "repositories.tagging_repository"]

        def call(id:, tagger_id:)
          tagging_repo.remove(id: id, tagger_id: tagger_id)
        end
      end
    end
  end
end
