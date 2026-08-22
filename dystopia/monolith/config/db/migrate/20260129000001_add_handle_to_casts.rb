# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table :portfolio__casts do
      add_column :handle, :varchar, size: 30, null: true
    end

    # Create unique index for case-insensitive handle lookup
    run "CREATE UNIQUE INDEX idx_casts_handle_lower ON portfolio.casts (LOWER(handle)) WHERE handle IS NOT NULL"
  end

  down do
    run "DROP INDEX IF EXISTS idx_casts_handle_lower"

    alter_table :portfolio__casts do
      drop_column :handle
    end
  end
end
