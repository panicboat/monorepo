# frozen_string_literal: true

require "storage"

module Media
  module UseCases
    class DiscardMedia
      include Media::Deps[repo: "repositories.media_repository"]

      def call(ids:)
        return if ids.nil? || ids.empty?

        repo.find_by_ids(ids).each do |media|
          keys = [media.media_key, media.thumbnail_key].reject { |key| key.nil? || key.empty? }
          # The row must outlive a failed delete, so the purge of the uploading profile can still find the file.
          next unless keys.map { |key| Storage.delete(key: key) }.all?

          repo.delete(media.id)
        end
        nil
      end
    end
  end
end
