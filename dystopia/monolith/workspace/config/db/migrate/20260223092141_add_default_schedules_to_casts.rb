# frozen_string_literal: true

ROM::SQL.migration do
  change do
    # Add new JSONB column
    alter_table :portfolio__casts do
      add_column :default_schedules, :jsonb, default: Sequel.lit("'[]'::jsonb")
    end

    # Migrate existing data
    run <<~SQL
      UPDATE portfolio.casts
      SET default_schedules = CASE
        WHEN default_schedule_start IS NOT NULL AND default_schedule_end IS NOT NULL
        THEN jsonb_build_array(jsonb_build_object('start', default_schedule_start, 'end', default_schedule_end))
        ELSE '[]'::jsonb
      END
    SQL

    # Drop old columns
    alter_table :portfolio__casts do
      drop_column :default_schedule_start
      drop_column :default_schedule_end
    end
  end
end
