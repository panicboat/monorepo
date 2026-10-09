# frozen_string_literal: true

module Media
  module UseCases
    class MediaKey
      def self.for(profile_id:, media_id:, extension: "")
        "media/#{profile_id}/#{media_id}#{extension}"
      end

      def self.owned_by?(media_key, profile_id:)
        return false if profile_id.to_s.empty?

        /\A#{Regexp.escape("media/#{profile_id}/")}[0-9a-f-]{36}(\.[a-z0-9]{1,10})?\z/.match?(media_key.to_s)
      end

      def self.issued_to?(media_key, profile_id:, media_id:)
        return false if profile_id.to_s.empty? || media_id.to_s.empty?

        /\A#{Regexp.escape(self.for(profile_id: profile_id, media_id: media_id))}(\.[a-z0-9]{1,10})?\z/.match?(media_key.to_s)
      end
    end
  end
end
