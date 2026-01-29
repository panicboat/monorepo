# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table(:portfolio__cast_areas) do
      column :cast_id, :uuid, null: false
      column :area_id, :uuid, null: false
      column :created_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")

      primary_key [:cast_id, :area_id]
      foreign_key [:cast_id], :portfolio__casts, on_delete: :cascade
      foreign_key [:area_id], :portfolio__areas, on_delete: :cascade
    end

    add_index :portfolio__cast_areas, :area_id, name: :idx_cast_areas_area_id
  end

  down do
    drop_table(:portfolio__cast_areas)
  end
end
