ROM::SQL.migration do
  change do
    alter_table :portfolio__casts do
      add_column :image_path, String
    end
  end
end
