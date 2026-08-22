# frozen_string_literal: true

ROM::SQL.migration do
  change do
    alter_table(:portfolio__guests) do
      add_column :tagline, String, size: 100
      add_column :bio, :text
    end
  end
end
