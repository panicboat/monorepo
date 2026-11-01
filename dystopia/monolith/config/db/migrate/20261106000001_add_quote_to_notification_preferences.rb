# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:notifications__preferences) do
      add_column :quote, :boolean, null: false, default: true
    end
  end

  down do
    alter_table(:notifications__preferences) do
      drop_column :quote
    end
  end
end
