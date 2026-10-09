# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:messaging__threads) do
      rename_column :account_a, :profile_a
      rename_column :account_b, :profile_b
    end
    alter_table(:messaging__messages) { rename_column :sender_id, :sender_profile_id }
    alter_table(:messaging__read_states) { rename_column :account_id, :profile_id }
    alter_table(:notifications__notifications) do
      rename_column :recipient_id, :recipient_profile_id
      rename_column :latest_actor_id, :latest_actor_profile_id
    end
    alter_table(:notifications__preferences) { rename_column :account_id, :profile_id }

    run "ALTER INDEX messaging.idx_threads_account_a_last RENAME TO idx_threads_profile_a_last"
    run "ALTER INDEX messaging.idx_threads_account_b_last RENAME TO idx_threads_profile_b_last"

    run "ALTER TABLE messaging.threads RENAME CONSTRAINT uq_threads_account_pair TO uq_threads_profile_pair"
    run "ALTER TABLE messaging.threads RENAME CONSTRAINT chk_threads_account_order TO chk_threads_profile_order"
    run "ALTER TABLE messaging.read_states RENAME CONSTRAINT read_states_account_id_not_null TO read_states_profile_id_not_null"
    run "ALTER TABLE notifications.notifications RENAME CONSTRAINT notifications_recipient_id_not_null TO notifications_recipient_profile_id_not_null"
    run "ALTER TABLE notifications.notifications RENAME CONSTRAINT notifications_latest_actor_id_not_null TO notifications_latest_actor_profile_id_not_null"
    run "ALTER TABLE notifications.preferences RENAME CONSTRAINT preferences_account_id_not_null TO preferences_profile_id_not_null"
  end

  down do
    run "ALTER TABLE notifications.preferences RENAME CONSTRAINT preferences_profile_id_not_null TO preferences_account_id_not_null"
    run "ALTER TABLE notifications.notifications RENAME CONSTRAINT notifications_latest_actor_profile_id_not_null TO notifications_latest_actor_id_not_null"
    run "ALTER TABLE notifications.notifications RENAME CONSTRAINT notifications_recipient_profile_id_not_null TO notifications_recipient_id_not_null"
    run "ALTER TABLE messaging.read_states RENAME CONSTRAINT read_states_profile_id_not_null TO read_states_account_id_not_null"
    run "ALTER TABLE messaging.threads RENAME CONSTRAINT chk_threads_profile_order TO chk_threads_account_order"
    run "ALTER TABLE messaging.threads RENAME CONSTRAINT uq_threads_profile_pair TO uq_threads_account_pair"

    run "ALTER INDEX messaging.idx_threads_profile_b_last RENAME TO idx_threads_account_b_last"
    run "ALTER INDEX messaging.idx_threads_profile_a_last RENAME TO idx_threads_account_a_last"

    alter_table(:notifications__preferences) { rename_column :profile_id, :account_id }
    alter_table(:notifications__notifications) do
      rename_column :latest_actor_profile_id, :latest_actor_id
      rename_column :recipient_profile_id, :recipient_id
    end
    alter_table(:messaging__read_states) { rename_column :profile_id, :account_id }
    alter_table(:messaging__messages) { rename_column :sender_profile_id, :sender_id }
    alter_table(:messaging__threads) do
      rename_column :profile_b, :account_b
      rename_column :profile_a, :account_a
    end
  end
end
