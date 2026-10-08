# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:social__follows) do
      rename_column :follower_id, :follower_profile_id
      rename_column :followee_id, :followee_profile_id
    end
    alter_table(:social__blocks) do
      rename_column :blocker_id, :blocker_profile_id
      rename_column :blocked_id, :blocked_profile_id
    end

    run "ALTER INDEX social.social_follows_follower_id_index RENAME TO social_follows_follower_profile_id_index"
    run "ALTER INDEX social.social_follows_followee_id_index RENAME TO social_follows_followee_profile_id_index"
    run "ALTER INDEX social.social_follows_followee_id_status_index RENAME TO social_follows_followee_profile_id_status_index"
    run "ALTER INDEX social.social_blocks_blocker_id_index RENAME TO social_blocks_blocker_profile_id_index"
    run "ALTER INDEX social.social_blocks_blocked_id_index RENAME TO social_blocks_blocked_profile_id_index"

    run "ALTER TABLE social.follows RENAME CONSTRAINT follows_follower_id_followee_id_key TO follows_follower_profile_id_followee_profile_id_key"
    run "ALTER TABLE social.follows RENAME CONSTRAINT follows_follower_id_not_null TO follows_follower_profile_id_not_null"
    run "ALTER TABLE social.follows RENAME CONSTRAINT follows_followee_id_not_null TO follows_followee_profile_id_not_null"
    run "ALTER TABLE social.blocks RENAME CONSTRAINT blocks_blocker_id_blocked_id_key TO blocks_blocker_profile_id_blocked_profile_id_key"
    run "ALTER TABLE social.blocks RENAME CONSTRAINT blocks_blocker_id_not_null TO blocks_blocker_profile_id_not_null"
    run "ALTER TABLE social.blocks RENAME CONSTRAINT blocks_blocked_id_not_null TO blocks_blocked_profile_id_not_null"
  end

  down do
    run "ALTER TABLE social.blocks RENAME CONSTRAINT blocks_blocked_profile_id_not_null TO blocks_blocked_id_not_null"
    run "ALTER TABLE social.blocks RENAME CONSTRAINT blocks_blocker_profile_id_not_null TO blocks_blocker_id_not_null"
    run "ALTER TABLE social.blocks RENAME CONSTRAINT blocks_blocker_profile_id_blocked_profile_id_key TO blocks_blocker_id_blocked_id_key"
    run "ALTER TABLE social.follows RENAME CONSTRAINT follows_followee_profile_id_not_null TO follows_followee_id_not_null"
    run "ALTER TABLE social.follows RENAME CONSTRAINT follows_follower_profile_id_not_null TO follows_follower_id_not_null"
    run "ALTER TABLE social.follows RENAME CONSTRAINT follows_follower_profile_id_followee_profile_id_key TO follows_follower_id_followee_id_key"

    run "ALTER INDEX social.social_blocks_blocked_profile_id_index RENAME TO social_blocks_blocked_id_index"
    run "ALTER INDEX social.social_blocks_blocker_profile_id_index RENAME TO social_blocks_blocker_id_index"
    run "ALTER INDEX social.social_follows_followee_profile_id_status_index RENAME TO social_follows_followee_id_status_index"
    run "ALTER INDEX social.social_follows_followee_profile_id_index RENAME TO social_follows_followee_id_index"
    run "ALTER INDEX social.social_follows_follower_profile_id_index RENAME TO social_follows_follower_id_index"

    alter_table(:social__blocks) do
      rename_column :blocked_profile_id, :blocked_id
      rename_column :blocker_profile_id, :blocker_id
    end
    alter_table(:social__follows) do
      rename_column :followee_profile_id, :followee_id
      rename_column :follower_profile_id, :follower_id
    end
  end
end
