# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table :"notifications__notifications" do
      add_column :target_post_id, :uuid, null: true
    end
  end
  down do
    alter_table :"notifications__notifications" do
      drop_column :target_post_id
    end
  end
end
