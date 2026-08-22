# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table :portfolio__casts do
      # Completely unused columns
      drop_column :occupation
      drop_column :charm_point
      drop_column :personality

      # Read-only, unused
      drop_column :promise_rate

      # Migrated to three_sizes JSONB
      drop_column :bust
      drop_column :waist
      drop_column :hip
      drop_column :cup_size

      # Migrated to cast_areas table
      drop_column :area

      # User-requested removal
      drop_column :service_category
      drop_column :location_type
    end
  end

  down do
    alter_table :portfolio__casts do
      add_column :occupation, String
      add_column :charm_point, String
      add_column :personality, String
      add_column :promise_rate, Float
      add_column :bust, Integer
      add_column :waist, Integer
      add_column :hip, Integer
      add_column :cup_size, String
      add_column :area, String
      add_column :service_category, String
      add_column :location_type, String
    end
  end
end
