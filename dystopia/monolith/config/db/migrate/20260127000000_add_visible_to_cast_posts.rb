# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table :"social__cast_posts" do
      add_column :visible, :boolean, null: false, default: true
    end
  end

  down do
    alter_table :"social__cast_posts" do
      drop_column :visible
    end
  end
end
