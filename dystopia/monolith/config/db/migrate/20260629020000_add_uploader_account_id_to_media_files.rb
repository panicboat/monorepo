# frozen_string_literal: true

ROM::SQL.migration do
  change do
    alter_table :media__files do
      add_column :uploader_account_id, :uuid
    end

    add_index :media__files, :uploader_account_id, name: :idx_media_files_uploader
  end
end
