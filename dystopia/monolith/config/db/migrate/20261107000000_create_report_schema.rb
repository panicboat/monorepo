# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "CREATE SCHEMA IF NOT EXISTS report"

    create_table :"report__reports" do
      column :id, :uuid, null: false
      column :reporter_account_id, :uuid, null: false
      column :reporter_profile_id, :uuid, null: false
      column :reported_account_id, :uuid
      column :reported_profile_id, :uuid
      column :target_type, :text, null: false
      column :target_id, :uuid, null: false
      column :reason, :text, null: false
      column :note, :text, null: false, default: ""
      column :target_content, :text, null: false, default: ""
      column :handled_at, :timestamptz
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      unique [:reporter_profile_id, :target_type, :target_id], name: :uq_reports_reporter_target
    end
  end

  down do
    drop_table :"report__reports"
    run "DROP SCHEMA IF EXISTS report CASCADE"
  end
end
