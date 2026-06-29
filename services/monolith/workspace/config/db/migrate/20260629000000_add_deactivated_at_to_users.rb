# frozen_string_literal: true

ROM::SQL.migration do
  change do
    alter_table :identity__users do
      add_column :deactivated_at, DateTime
    end
  end
end
