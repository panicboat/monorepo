# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table :"footprints__visits" do
      add_column :visit_count, :integer, null: false, default: 1
    end
  end

  down do
    alter_table :"footprints__visits" do
      drop_column :visit_count
    end
  end
end
