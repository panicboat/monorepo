# frozen_string_literal: true

ROM::SQL.migration do
  change do
    drop_table(:social__cast_favorites)
  end
end
