# frozen_string_literal: true

module Trust
  module UseCases
    module Taggings
      class RejectTagging
        include Trust::Deps[tagging_repo: "repositories.tagging_repository"]

        def call(id:, target_id:)
          tagging = tagging_repo.find_by_id(id: id)
          return false unless tagging
          return false unless tagging.target_id == target_id

          tagging_repo.reject(id: id)
        end
      end
    end
  end
end
