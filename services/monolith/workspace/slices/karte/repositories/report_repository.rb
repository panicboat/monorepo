# frozen_string_literal: true

module Karte
  module Repositories
    class ReportRepository < Karte::DB::Repo
      # Idempotent INSERT. Returns true if a new row was inserted, false if
      # (entry_id, reporter_account_id) was already reported by the same Cast.
      def create(entry_id:, reporter_account_id:, reason:)
        new_id = SecureRandom.uuid_v7

        sql = <<~SQL
          INSERT INTO karte.reports (id, entry_id, reporter_account_id, reason, created_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (entry_id, reporter_account_id) DO NOTHING
          RETURNING id
        SQL

        ds = report_records.dataset.db
        result = ds.fetch(sql, new_id, entry_id, reporter_account_id, reason, Time.now).first
        !result.nil?
      end
    end
  end
end
