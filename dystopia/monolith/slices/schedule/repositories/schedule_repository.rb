# frozen_string_literal: true

module Schedule
  module Repositories
    class ScheduleRepository < Schedule::DB::Repo
      DAY_START = "05:00"
      EVENING_START = "18:00"
      NIGHT_START = "21:00"

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
        start_time = Sequel[:start_time]

        case time_band
        when nil, "" then scope
        when "day" then scope.where((start_time >= DAY_START) & (start_time < EVENING_START))
        when "evening" then scope.where((start_time >= EVENING_START) & (start_time < NIGHT_START))
        when "night" then scope.where((start_time >= NIGHT_START) | (start_time < DAY_START))
        else raise ArgumentError, "unknown time band: #{time_band.inspect}"
        end
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
