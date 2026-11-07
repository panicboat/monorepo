# frozen_string_literal: true

require "date"
require "text"

module Review
  module UseCases
    class ValidateEvent
      JAPAN_OFFSET = "+09:00"
      DATE_FORMAT = /\A\d{4}-\d{2}-\d{2}\z/

      def call(stage:, outcome:, tags:, note:, occurred_on:, media: [], today: Time.now.getlocal(JAPAN_OFFSET).to_date)
        raise Errors::Invalid, "Unknown stage" unless Catalog::STAGES.include?(stage)
        raise Errors::Invalid, "Unknown outcome for the stage" unless Catalog::OUTCOMES.fetch(stage).include?(outcome)

        tags = Array(tags)
        raise Errors::Invalid, "Duplicate tags" unless tags.uniq.length == tags.length
        raise Errors::Invalid, "Unknown tag for the stage" unless (tags - Catalog::TAGS.fetch(stage)).empty?

        note = note.to_s
        raise Errors::Invalid, "Note too long" if note.length > Catalog::MAX_NOTE_LENGTH
        blank_note = Text.blank?(note)
        if blank_note && Catalog::NOTE_REQUIRED_OUTCOMES.fetch(stage).include?(outcome)
          raise Errors::Invalid, "Note required for this outcome"
        end

        date = parse_date(occurred_on)
        raise Errors::Invalid, "Occurred date is in the future" if date > today

        { stage: stage, outcome: outcome, tags: tags, note: blank_note ? nil : note, occurred_on: date, media: validate_media(stage, media) }
      end

      private

      def validate_media(stage, media)
        media = normalize_media(media)
        return media if media.empty?

        raise Errors::Invalid, "Media only on the service stage" unless stage == "service"
        raise Errors::Invalid, "Too many media" if media.length > Catalog::MAX_MEDIA_COUNT

        ids = media.map { |item| item[:media_id] }
        raise Errors::Invalid, "Invalid media id" unless ids.all? { |id| Ids.valid?(id) }
        raise Errors::Invalid, "Duplicate media" unless ids.uniq.length == ids.length
        raise Errors::Invalid, "Unknown media type" unless media.all? { |item| Catalog::MEDIA_TYPES.include?(item[:media_type]) }

        media
      end

      def normalize_media(media)
        Array(media).map do |item|
          { media_id: (item[:media_id] || item["media_id"]).to_s, media_type: item[:media_type] || item["media_type"] }
        end
      end

      def parse_date(value)
        raise Errors::Invalid, "Occurred date must be YYYY-MM-DD" unless value.is_a?(String) && DATE_FORMAT.match?(value)

        Date.iso8601(value)
      rescue Date::Error
        raise Errors::Invalid, "Occurred date must be YYYY-MM-DD"
      end
    end
  end
end
