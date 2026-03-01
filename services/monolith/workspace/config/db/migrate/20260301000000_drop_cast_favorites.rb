# frozen_string_literal: true

ROM::SQL.migration do
  up do
    drop_table(:social__cast_favorites)
  end
end
