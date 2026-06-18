ROM::SQL.migration do
  up do
    alter_table :"notifications__preferences" do
      add_column :footprints_record_my_visits, :boolean, null: false, default: true
    end
  end
  down do
    alter_table :"notifications__preferences" do
      drop_column :footprints_record_my_visits
    end
  end
end
