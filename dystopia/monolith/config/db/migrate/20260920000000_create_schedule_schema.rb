# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "CREATE SCHEMA IF NOT EXISTS schedule"

    create_table :"schedule__schedules" do
      column :id, :uuid, null: false
      column :account_id, :uuid, null: false
      column :work_date, :date, null: false
      column :start_time, :varchar, size: 5, null: false
      column :end_time, :varchar, size: 5, null: false
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:account_id, :work_date], name: :uq_schedule_schedules_account_date
    end
  end

  down do
    drop_table :"schedule__schedules"
    run "DROP SCHEMA IF EXISTS schedule CASCADE"
  end
end
