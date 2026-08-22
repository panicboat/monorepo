# frozen_string_literal: true

ROM::SQL.migration do
  up do
    # Create offer schema
    run "CREATE SCHEMA IF NOT EXISTS offer"

    # Move tables from portfolio to offer domain
    run "ALTER TABLE portfolio.cast_plans SET SCHEMA offer"
    run "ALTER TABLE portfolio.cast_schedules SET SCHEMA offer"
  end

  down do
    run "ALTER TABLE offer.cast_plans SET SCHEMA portfolio"
    run "ALTER TABLE offer.cast_schedules SET SCHEMA portfolio"
    run "DROP SCHEMA IF EXISTS offer"
  end
end
