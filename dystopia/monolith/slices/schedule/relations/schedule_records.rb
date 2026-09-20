# frozen_string_literal: true

module Schedule
  module Relations
    class ScheduleRecords < Schedule::DB::Relation
      schema(:"schedule__schedules", as: :schedule_records, infer: false) do
        attribute :id, Types::String
        attribute :account_id, Types::String
        attribute :work_date, Types::Date
        attribute :start_time, Types::String
        attribute :end_time, Types::String
        attribute :created_at, Types::Time
        attribute :updated_at, Types::Time

        primary_key :id
      end
    end
  end
end
