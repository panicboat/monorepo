# frozen_string_literal: true

# Drop write-only columns because no runtime consumer reads them.
ROM::SQL.migration do
  up do
    alter_table :"footprints__visits" do
      drop_column :first_visited_at
    end

    alter_table :"karte__access" do
      drop_column :granted_by
    end
  end

  down do
    alter_table :"footprints__visits" do
      add_column :first_visited_at, "timestamp with time zone", null: false, default: Sequel.lit("now()")
    end

    alter_table :"karte__access" do
      add_column :granted_by, :text
    end
  end
end
