# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table :portfolio__casts do
      add_column :registered_at, :timestamptz
    end
  end

  down do
    alter_table :portfolio__casts do
      drop_column :registered_at
    end
  end
end
