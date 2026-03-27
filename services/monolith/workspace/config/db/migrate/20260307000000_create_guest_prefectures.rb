# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table(:portfolio__guest_prefectures) do
      column :guest_user_id, :uuid, null: false
      column :prefecture, :varchar, size: 50, null: false
      column :created_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")

      primary_key [:guest_user_id, :prefecture]
      foreign_key [:guest_user_id], :portfolio__guests, key: [:user_id], on_delete: :cascade
    end

    add_index :portfolio__guest_prefectures, :prefecture, name: :idx_guest_prefectures_prefecture
  end

  down do
    drop_table(:portfolio__guest_prefectures)
  end
end
