# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:profile__profiles) do
      add_column :body_stats, :jsonb, null: false, default: Sequel.lit("'{}'::jsonb")
    end

    run <<~SQL
      UPDATE profile.profiles
      SET body_stats = jsonb_strip_nulls(jsonb_build_object('height_cm', height_cm, 'cup', cup_size))
      WHERE height_cm IS NOT NULL OR cup_size IS NOT NULL
    SQL

    alter_table(:profile__profiles) do
      drop_column :height_cm
      drop_column :cup_size
      drop_column :shop_id
    end
  end

  down do
    alter_table(:profile__profiles) do
      add_column :height_cm, :integer
      add_column :cup_size, :varchar, size: 10
      add_column :shop_id, :uuid
    end

    run <<~SQL
      UPDATE profile.profiles
      SET height_cm = (body_stats->>'height_cm')::integer,
          cup_size = body_stats->>'cup'
    SQL

    alter_table(:profile__profiles) do
      drop_column :body_stats
    end
  end
end
