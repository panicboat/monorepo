# frozen_string_literal: true

# Drops the orphaned offer.schedules table. The offer slice was removed in the
# 2026-05-29 commerce dimension drop, leaving this table with no writer; the
# only readers (cast online-status queries) were dead code and have been removed.
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
