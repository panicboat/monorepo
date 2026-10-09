# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:review__entries) do
      rename_column :author_account_id, :author_profile_id
      rename_column :target_account_id, :target_profile_id
    end
    alter_table(:review__cast_settings) { rename_column :account_id, :profile_id }

    run "ALTER TABLE review.entries RENAME CONSTRAINT entries_author_account_id_not_null TO entries_author_profile_id_not_null"
    run "ALTER TABLE review.entries RENAME CONSTRAINT entries_target_account_id_not_null TO entries_target_profile_id_not_null"
    run "ALTER TABLE review.cast_settings RENAME CONSTRAINT cast_settings_account_id_not_null TO cast_settings_profile_id_not_null"
  end

  down do
    run "ALTER TABLE review.cast_settings RENAME CONSTRAINT cast_settings_profile_id_not_null TO cast_settings_account_id_not_null"
    run "ALTER TABLE review.entries RENAME CONSTRAINT entries_target_profile_id_not_null TO entries_target_account_id_not_null"
    run "ALTER TABLE review.entries RENAME CONSTRAINT entries_author_profile_id_not_null TO entries_author_account_id_not_null"

    alter_table(:review__cast_settings) { rename_column :profile_id, :account_id }
    alter_table(:review__entries) do
      rename_column :target_profile_id, :target_account_id
      rename_column :author_profile_id, :author_account_id
    end
  end
end
