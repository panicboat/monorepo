# frozen_string_literal: true

ROM::SQL.migration do
  up do
    create_schema :identity unless tables.any? { |t| t.to_s.start_with?("identity__") }

    create_table :"identity__accounts" do
      column :id,             :uuid,       null: false
      column :role,           Integer,     null: false
      column :deactivated_at, DateTime,    null: true
      column :created_at,     DateTime,    null: false, default: Sequel.lit("now()")
      column :updated_at,     DateTime,    null: false, default: Sequel.lit("now()")

      primary_key [:id]
      index :deactivated_at, name: :idx_identity_accounts_deactivated_at,
            where: "deactivated_at IS NOT NULL"
    end
  end

  down do
    drop_table :"identity__accounts"
  end
end
