# frozen_string_literal: true

Sequel.migration do
  up do
    # Convert null prices to 0 (Ask)
    run "UPDATE portfolio.cast_plans SET price = 0 WHERE price IS NULL"

    # Restore NOT NULL constraint
    alter_table :portfolio__cast_plans do
      set_column_not_null :price
    end
  end

  down do
    alter_table :portfolio__cast_plans do
      set_column_allow_null :price
    end
  end
end
