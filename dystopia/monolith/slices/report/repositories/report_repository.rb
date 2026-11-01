# frozen_string_literal: true

module Report
  module Repositories
    class ReportRepository < Report::DB::Repo
      def create_once(attrs)
        report_records.dataset
          .insert_conflict(target: [:reporter_profile_id, :target_type, :target_id])
          .insert(attrs.merge(id: SecureRandom.uuid_v7))
      end
    end
  end
end
