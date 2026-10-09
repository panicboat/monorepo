# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:media__files) do
      add_column :owner_account_id, :uuid, null: true
      add_index :owner_account_id, name: :idx_media_files_owner_account
    end

    run <<~SQL
      UPDATE media.files AS files
      SET owner_account_id = profiles.account_id
      FROM profile.profiles AS profiles
      WHERE profiles.id = files.uploader_profile_id
    SQL
  end

  down do
    alter_table(:media__files) do
      drop_index :owner_account_id, name: :idx_media_files_owner_account
      drop_column :owner_account_id
    end
  end
end
