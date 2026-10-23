# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table :"notifications__preferences" do
      drop_column :push_enabled
    end
  end

  down do
    alter_table :"notifications__preferences" do
      add_column :push_enabled, :boolean, null: false, default: true
    end
  end
end
