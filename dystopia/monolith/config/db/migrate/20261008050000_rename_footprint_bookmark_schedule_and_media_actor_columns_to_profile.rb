# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:footprints__visits) do
      rename_column :visitor_id, :visitor_profile_id
      rename_column :visited_id, :visited_profile_id
    end
    alter_table(:footprints__read_states) { rename_column :account_id, :profile_id }
    alter_table(:bookmarks__bookmarks) { rename_column :account_id, :profile_id }
    alter_table(:schedule__schedules) { rename_column :account_id, :profile_id }
    alter_table(:media__files) { rename_column :uploader_account_id, :uploader_profile_id }

    run "ALTER INDEX bookmarks.idx_bookmarks_account_created RENAME TO idx_bookmarks_profile_created"

    run "ALTER TABLE footprints.visits RENAME CONSTRAINT visits_visitor_id_not_null TO visits_visitor_profile_id_not_null"
    run "ALTER TABLE footprints.visits RENAME CONSTRAINT visits_visited_id_not_null TO visits_visited_profile_id_not_null"
    run "ALTER TABLE footprints.read_states RENAME CONSTRAINT read_states_account_id_not_null TO read_states_profile_id_not_null"
    run "ALTER TABLE bookmarks.bookmarks RENAME CONSTRAINT uq_bookmarks_account_post TO uq_bookmarks_profile_post"
    run "ALTER TABLE bookmarks.bookmarks RENAME CONSTRAINT bookmarks_account_id_not_null TO bookmarks_profile_id_not_null"
    run "ALTER TABLE schedule.schedules RENAME CONSTRAINT uq_schedule_schedules_account_date TO uq_schedule_schedules_profile_date"
    run "ALTER TABLE schedule.schedules RENAME CONSTRAINT schedules_account_id_not_null TO schedules_profile_id_not_null"
  end

  down do
    run "ALTER TABLE schedule.schedules RENAME CONSTRAINT schedules_profile_id_not_null TO schedules_account_id_not_null"
    run "ALTER TABLE schedule.schedules RENAME CONSTRAINT uq_schedule_schedules_profile_date TO uq_schedule_schedules_account_date"
    run "ALTER TABLE bookmarks.bookmarks RENAME CONSTRAINT bookmarks_profile_id_not_null TO bookmarks_account_id_not_null"
    run "ALTER TABLE bookmarks.bookmarks RENAME CONSTRAINT uq_bookmarks_profile_post TO uq_bookmarks_account_post"
    run "ALTER TABLE footprints.read_states RENAME CONSTRAINT read_states_profile_id_not_null TO read_states_account_id_not_null"
    run "ALTER TABLE footprints.visits RENAME CONSTRAINT visits_visited_profile_id_not_null TO visits_visited_id_not_null"
    run "ALTER TABLE footprints.visits RENAME CONSTRAINT visits_visitor_profile_id_not_null TO visits_visitor_id_not_null"

    run "ALTER INDEX bookmarks.idx_bookmarks_profile_created RENAME TO idx_bookmarks_account_created"

    alter_table(:media__files) { rename_column :uploader_profile_id, :uploader_account_id }
    alter_table(:schedule__schedules) { rename_column :profile_id, :account_id }
    alter_table(:bookmarks__bookmarks) { rename_column :profile_id, :account_id }
    alter_table(:footprints__read_states) { rename_column :profile_id, :account_id }
    alter_table(:footprints__visits) do
      rename_column :visited_profile_id, :visited_id
      rename_column :visitor_profile_id, :visitor_id
    end
  end
end
