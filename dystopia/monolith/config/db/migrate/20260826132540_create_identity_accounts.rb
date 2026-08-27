# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_schema :identity

    create_table :"identity__accounts" do
      column :id,             :uuid,        null: false
      column :role,           Integer,      null: false
      column :deactivated_at, :timestamptz, null: true
      column :created_at,     :timestamptz, null: false, default: Sequel.lit("now()")
      column :updated_at,     :timestamptz, null: false, default: Sequel.lit("now()")

      primary_key [:id]
      index :deactivated_at, name: :idx_identity_accounts_deactivated_at,
            where: "deactivated_at IS NOT NULL"
    end
  end

  down do
    drop_table :"identity__accounts"
  end
end
