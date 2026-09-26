# frozen_string_literal: true

# No discovery/search/matching query ever read area_ids; its only consumer was a profile-page label.
ROM::SQL.migration do
  up do
    drop_table :"profile__profile_areas"
    drop_table :"profile__areas"
  end

  down do
    create_table(:"profile__areas") do
      column :id, :uuid, null: false
      column :prefecture, :varchar, size: 50, null: false
      column :name, :varchar, size: 100, null: false
      column :code, :varchar, size: 50, null: false
      column :sort_order, :integer, null: false, default: 0
      column :active, :boolean, null: false, default: true
      column :region, :varchar, size: 50
      column :created_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")
      column :updated_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")

      primary_key [:id]
      unique [:code]
    end

    create_table(:"profile__profile_areas") do
      column :profile_id, :uuid, null: false
      column :area_id, :uuid, null: false
      column :created_at, :timestamp, null: false, default: Sequel.lit("CURRENT_TIMESTAMP")

      primary_key [:profile_id, :area_id]
      foreign_key [:profile_id], :"profile__profiles", key: [:account_id], on_delete: :cascade
      foreign_key [:area_id], :"profile__areas", key: [:id], on_delete: :cascade
    end
    add_index :"profile__profile_areas", :area_id, name: :idx_profile_areas_area_id
  end
end
