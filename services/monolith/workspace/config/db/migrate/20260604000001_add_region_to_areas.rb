# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:portfolio__areas) do
      add_column :region, :varchar, size: 50
    end
  end

  down do
    alter_table(:portfolio__areas) do
      drop_column :region
    end
  end
end
