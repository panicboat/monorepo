# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:schedule__schedules) do
      add_column :post_id, :uuid
      add_index :post_id, where: Sequel.~(post_id: nil), name: :idx_schedule_schedules_post_id
    end
  end

  down do
    alter_table(:schedule__schedules) do
      drop_index :post_id, name: :idx_schedule_schedules_post_id
      drop_column :post_id
    end
  end
end
