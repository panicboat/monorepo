# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table :"portfolio__guests" do
      add_column :avatar_media_id, :uuid
      add_index :avatar_media_id
    end
  end

  down do
    alter_table :"portfolio__guests" do
      drop_index :avatar_media_id
      drop_column :avatar_media_id
    end
  end
end
