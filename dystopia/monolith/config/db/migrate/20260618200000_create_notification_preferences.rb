# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_table :"notifications__preferences" do
      column :account_id, :uuid, null: false
      column :push_enabled, :boolean, null: false, default: true
      column :post, :boolean, null: false, default: true
      column :like, :boolean, null: false, default: true
      column :repost, :boolean, null: false, default: true
      column :quote, :boolean, null: false, default: true
      column :reply, :boolean, null: false, default: true
      column :follow, :boolean, null: false, default: true
      column :mention, :boolean, null: false, default: true
      column :message, :boolean, null: false, default: true
      column :oshi, :boolean, null: false, default: true
      column :footprint_unread_badge, :boolean, null: false, default: true
      column :created_at, :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at, :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:account_id]
    end
  end

  down do
    drop_table :"notifications__preferences"
  end
end
