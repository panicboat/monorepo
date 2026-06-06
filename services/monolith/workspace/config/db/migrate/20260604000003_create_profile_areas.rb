# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table(:portfolio__profile_areas) do
      column :profile_id, :uuid, null: false
      column :area_id, :uuid, null: false
      column :created_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")

      primary_key [:profile_id, :area_id]
      foreign_key [:profile_id], :portfolio__profiles, key: [:account_id], on_delete: :cascade
      foreign_key [:area_id], :portfolio__areas, key: [:id], on_delete: :cascade
    end

    add_index :portfolio__profile_areas, :area_id, name: :idx_profile_areas_area_id
  end

  down do
    drop_table(:portfolio__profile_areas)
  end
end
