# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:schedule__schedules) do
      add_index [:work_date, :start_time], name: :idx_schedule_schedules_work_date_start_time
    end
  end

  down do
    alter_table(:schedule__schedules) do
      drop_index [:work_date, :start_time], name: :idx_schedule_schedules_work_date_start_time
    end
  end
end
