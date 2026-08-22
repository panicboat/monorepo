# frozen_string_literal: true

ROM::SQL.migration do
  up do
    rename_column :portfolio__casts, :status, :visibility
    run "UPDATE portfolio.casts SET visibility = 'unregistered' WHERE visibility IN ('offline', 'asking', 'online', 'tonight') OR visibility IS NULL"
  end

  down do
    run "UPDATE portfolio.casts SET visibility = 'offline' WHERE visibility NOT IN ('offline', 'asking', 'online', 'tonight')"
    rename_column :portfolio__casts, :visibility, :status
  end
end
