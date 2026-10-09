# frozen_string_literal: true

module Schedule
  module Repositories
    class ScheduleRepository < Schedule::DB::Repo
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
          RETURNING id, profile_id, work_date, start_time, end_time, created_at, updated_at
        SQL

        ds = schedule_records.dataset.db
        ds.fetch(sql, new_id, profile_id, work_date, start_time, end_time, now, now).first
      end

      def delete(profile_id:, work_date:)
        schedule_records.dataset.where(profile_id: profile_id, work_date: work_date).delete
      end

      def delete_by_profile(profile_id)
        schedule_records.dataset.where(profile_id: profile_id).delete
      end
    end
  end
end
