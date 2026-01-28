# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table :portfolio__casts do
      add_column :avatar_path, :text
    end
  end

  down do
    alter_table :portfolio__casts do
      drop_column :avatar_path
    end
  end
end
