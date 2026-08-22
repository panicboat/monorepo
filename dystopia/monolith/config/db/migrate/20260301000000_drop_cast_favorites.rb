# frozen_string_literal: true

ROM::SQL.migration do
  up do
    drop_table(:relationship__favorites)
    run "DROP SCHEMA IF EXISTS social"
  end
end
