# frozen_string_literal: true

ROM::SQL.migration do
  up do
    drop_table :"offer__schedules"
  end

  down do
    create_table :"offer__schedules" do
      column :id, :uuid, null: false
      column :cast_user_id, :uuid, null: false
      column :date, :date, null: false
      column :start_time, :text, null: false
      column :end_time, :text, null: false
      column :created_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")
      column :updated_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")

      primary_key [:id]
      index :cast_user_id, name: :offer_schedules_cast_user_id_index
    end
  end
end
