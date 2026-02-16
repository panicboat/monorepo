# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "ALTER TABLE offer.cast_plans RENAME TO plans"
    run "ALTER TABLE offer.cast_schedules RENAME TO schedules"
  end

  down do
    run "ALTER TABLE offer.plans RENAME TO cast_plans"
    run "ALTER TABLE offer.schedules RENAME TO cast_schedules"
  end
end
