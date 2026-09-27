# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "ALTER SCHEMA portfolio RENAME TO profile"
  end

  down do
    run "ALTER SCHEMA profile RENAME TO portfolio"
  end
end
