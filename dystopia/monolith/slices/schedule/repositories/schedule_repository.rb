# frozen_string_literal: true

module Schedule
  module Repositories
    class ScheduleRepository < Schedule::DB::Repo
      def list(account_id:, from_date:, to_date:)
        schedule_records
          .where(account_id: account_id)
          .where { (work_date >= from_date) & (work_date <= to_date) }
          .order { work_date.asc }
          .to_a
      end

      # Upserts by (account_id, work_date); returns a raw-SQL row hash, matching FootprintsRepository#upsert_visit
      def upsert(account_id:, work_date:, start_time:, end_time:)
        new_id = SecureRandom.uuid_v7
        now = Time.now

        sql = <<~SQL
          INSERT INTO schedule.schedules
            (id, account_id, work_date, start_time, end_time, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (account_id, work_date) DO UPDATE
            SET start_time = EXCLUDED.start_time,
                end_time = EXCLUDED.end_time,
                updated_at = EXCLUDED.updated_at
          RETURNING id, account_id, work_date, start_time, end_time, created_at, updated_at
        SQL

        ds = schedule_records.dataset.db
        ds.fetch(sql, new_id, account_id, work_date, start_time, end_time, now, now).first
      end

      def delete(account_id:, work_date:)
        schedule_records.dataset.where(account_id: account_id, work_date: work_date).delete
      end
    end
  end
end
