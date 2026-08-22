# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table :portfolio__cast_plans do
      add_column :is_recommended, TrueClass, default: false, null: false
    end
  end

  down do
    alter_table :portfolio__cast_plans do
      drop_column :is_recommended
    end
  end
end
