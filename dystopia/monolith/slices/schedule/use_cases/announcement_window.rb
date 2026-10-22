# frozen_string_literal: true

module Schedule
  module UseCases
    class AnnouncementWindow
      JST_OFFSET = "+09:00"
      BUSINESS_DAY_START = "05:00"

      Window = Struct.new(:published_at, :expires_at, :announce_at, :now, keyword_init: true) do
        def ended?
          expires_at <= now
        end

        def announce_before_end?
          announce_at < expires_at
        end
      end

      def call(work_date:, start_time:, end_time:, announce_time:, now:)
        date = Date.iso8601(work_date)
        announce_at = instant(date, announce_time)
        start_date = start_time < BUSINESS_DAY_START ? date + 1 : date
        end_date = end_time <= start_time ? start_date + 1 : start_date

        Window.new(
          published_at: [announce_at, now].max,
          expires_at: instant(end_date, end_time),
          announce_at: announce_at,
          now: now
        )
      end

      private

      def instant(date, time)
        hour, minute = time.split(":").map(&:to_i)
        Time.new(date.year, date.month, date.day, hour, minute, 0, JST_OFFSET)
      end
    end
  end
end
