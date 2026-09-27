# frozen_string_literal: true

# Use ON CONFLICT DO NOTHING so rerunning the data migration is idempotent.
ROM::SQL.migration do
  up do
    run <<~SQL
      INSERT INTO social.follows (id, follower_id, followee_id, status, created_at, updated_at)
      SELECT id, guest_user_id, cast_user_id, status, created_at, created_at
      FROM relationship.follows
      ON CONFLICT (follower_id, followee_id) DO NOTHING
    SQL

    run <<~SQL
      INSERT INTO social.blocks (id, blocker_id, blocked_id, created_at)
      SELECT id, blocker_id, blocked_id, created_at
      FROM relationship.blocks
      ON CONFLICT (blocker_id, blocked_id) DO NOTHING
    SQL
  end

  down do
    run <<~SQL
      DELETE FROM social.follows s
      USING relationship.follows r
      WHERE s.follower_id = r.guest_user_id
        AND s.followee_id = r.cast_user_id
    SQL

    run <<~SQL
      DELETE FROM social.blocks s
      USING relationship.blocks r
      WHERE s.blocker_id = r.blocker_id
        AND s.blocked_id = r.blocked_id
    SQL
  end
end
