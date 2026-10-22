# frozen_string_literal: true

module Schedule
  module Repositories
    class ScheduleRepository < Schedule::DB::Repo
      DAY_START = "05:00"
      # Bands are [from, to) in minutes from the work date's midnight; the business day runs 05:00 to 05:00.
      TIME_BANDS = {
        "day" => [5 * 60, 18 * 60],
        "evening" => [18 * 60, 21 * 60],
        "night" => [21 * 60, 29 * 60]
      }.freeze
      START_MINUTES = "(CAST(substr(start_time, 1, 2) AS integer) * 60 + CAST(substr(start_time, 4, 2) AS integer))"
      END_MINUTES = "(CAST(substr(end_time, 1, 2) AS integer) * 60 + CAST(substr(end_time, 4, 2) AS integer))"
      BUSINESS_DAY_SHIFT = "(CASE WHEN start_time < '#{DAY_START}' THEN 1440 ELSE 0 END)"
      WORK_START = "(#{START_MINUTES} + #{BUSINESS_DAY_SHIFT})"
      WORK_END = "(#{END_MINUTES} + #{BUSINESS_DAY_SHIFT} + (CASE WHEN end_time <= start_time THEN 1440 ELSE 0 END))"

      def list(profile_id:, from_date:, to_date:)
        schedule_records
          .where(profile_id: profile_id)
          .where { (work_date >= from_date) & (work_date <= to_date) }
          .order { work_date.asc }
          .to_a
      end

      def upsert(profile_id:, work_date:, start_time:, end_time:)
        new_id = SecureRandom.uuid_v7
        now = Time.now

        sql = <<~SQL
          INSERT INTO schedule.schedules
            (id, profile_id, work_date, start_time, end_time, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (profile_id, work_date) DO UPDATE
            SET start_time = EXCLUDED.start_time,
                end_time = EXCLUDED.end_time,
                updated_at = EXCLUDED.updated_at
          RETURNING id, profile_id, work_date, start_time, end_time, post_id, created_at, updated_at
        SQL

        ds = schedule_records.dataset.db
        ds.fetch(sql, new_id, profile_id, work_date, start_time, end_time, now, now).first
      end

      def find(profile_id:, work_date:)
        schedule_records.dataset.where(profile_id: profile_id, work_date: work_date).first
      end

      def set_post_id(id:, post_id:)
        schedule_records.dataset.where(id: id).update(post_id: post_id)
      end

      def find_by_post_ids(post_ids:)
        return {} if post_ids.nil? || post_ids.empty?

        schedule_records.dataset.where(post_id: post_ids).to_h do |row|
          [row[:post_id].to_s, { work_date: row[:work_date].to_s, start_time: row[:start_time], end_time: row[:end_time] }]
        end
      end

      # Starts before DAY_START sort after 23:59 so the small hours follow the evening ones.
      def search(work_date:, time_band:, profile_ids:, limit:, cursor: nil)
        return [] if profile_ids.empty?

        scope = schedule_records.dataset.where(work_date: work_date, profile_id: profile_ids)
        scope = filter_by_time_band(scope, time_band)
        scope = after_cursor(scope, cursor) if cursor

        scope.order(small_hours_last, :start_time, :profile_id).limit(limit + 1).all
      end

      def delete(profile_id:, work_date:)
        schedule_records.dataset.where(profile_id: profile_id, work_date: work_date).delete
      end

      def delete_by_profile(profile_id)
        schedule_records.dataset.where(profile_id: profile_id).delete
      end

      private

      def small_hours_last
        Sequel.case({ (Sequel[:start_time] < DAY_START) => 1 }, 0)
      end

      def filter_by_time_band(scope, time_band)
        return scope if time_band.nil? || time_band == ""

        from, to = TIME_BANDS.fetch(time_band) { raise ArgumentError, "unknown time band: #{time_band.inspect}" }
        scope.where(Sequel.lit("#{WORK_START} < ? AND #{WORK_END} > ?", to, from))
      end

      def after_cursor(scope, cursor)
        start_time = Sequel[:start_time]
        later = (start_time > cursor[:start_time]) |
          (Sequel.expr(start_time: cursor[:start_time]) & (Sequel[:profile_id] > cursor[:profile_id]))

        if cursor[:start_time] < DAY_START
          scope.where(start_time < DAY_START).where(later)
        else
          scope.where((start_time < DAY_START) | later)
        end
      end
    end
  end
end
