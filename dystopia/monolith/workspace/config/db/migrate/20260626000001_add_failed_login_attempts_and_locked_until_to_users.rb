# frozen_string_literal: true

ROM::SQL.migration do
  change do
    alter_table :identity__users do
      add_column :failed_login_attempts, Integer, null: false, default: 0
      add_column :locked_until, DateTime
    end
  end
end
