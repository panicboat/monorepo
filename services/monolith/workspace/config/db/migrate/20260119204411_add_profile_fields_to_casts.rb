Hanami::Model.migration do
  change do
    alter_table :casts do
      add_column :tagline, String, null: true
      add_column :service_category, String, null: true
      add_column :location_type, String, null: true
      add_column :area, String, null: true
      add_column :default_shift_start, String, null: true
      add_column :default_shift_end, String, null: true
    end
  end
end
