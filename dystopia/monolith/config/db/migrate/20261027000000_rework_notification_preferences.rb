# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:notifications__preferences) do
      drop_column :repost
      drop_column :quote
      drop_column :oshi
      rename_column :post, :comment
    end
  end

  down do
    alter_table(:notifications__preferences) do
      rename_column :comment, :post
      add_column :repost, :boolean, null: false, default: true
      add_column :quote, :boolean, null: false, default: true
      add_column :oshi, :boolean, null: false, default: true
    end
  end
end
