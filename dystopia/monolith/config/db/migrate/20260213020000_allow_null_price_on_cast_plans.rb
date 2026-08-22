# frozen_string_literal: true

Sequel.migration do
  change do
    alter_table :portfolio__cast_plans do
      set_column_allow_null :price
    end
  end
end
