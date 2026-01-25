# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table :portfolio__casts do
      add_column :three_sizes, :jsonb, default: '{}'
    end

    # Migrate existing data from individual columns to three_sizes (if any data exists)
    run <<~SQL
      UPDATE portfolio.casts
      SET three_sizes = jsonb_build_object(
        'bust', COALESCE(bust, 0),
        'waist', COALESCE(waist, 0),
        'hip', COALESCE(hip, 0),
        'cup', COALESCE(cup_size, '')
      )
      WHERE bust IS NOT NULL OR waist IS NOT NULL OR hip IS NOT NULL OR cup_size IS NOT NULL
    SQL
  end

  down do
    alter_table :portfolio__casts do
      drop_column :three_sizes
    end
  end
end
