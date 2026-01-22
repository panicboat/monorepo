# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table :portfolio__casts do
      rename_column :default_shift_start, :default_schedule_start
      rename_column :default_shift_end, :default_schedule_end
    end
  end

  down do
    alter_table :portfolio__casts do
      rename_column :default_schedule_start, :default_shift_start
      rename_column :default_schedule_end, :default_shift_end
    end
  end
end
