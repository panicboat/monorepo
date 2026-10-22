# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:profile__profiles) do
      add_column :area, :text
    end
  end

  down do
    alter_table(:profile__profiles) do
      drop_column :area
    end
  end
end
