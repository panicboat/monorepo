# frozen_string_literal: true


ROM::SQL.migration do
  up do
    alter_table :"social__cast_follows" do
      add_column :status, :text, null: false, default: "approved"
    end

    alter_table :"social__cast_follows" do
      add_index :status
    end
  end

  down do
    alter_table :"social__cast_follows" do
      drop_index :status
      drop_column :status
    end
  end
end
