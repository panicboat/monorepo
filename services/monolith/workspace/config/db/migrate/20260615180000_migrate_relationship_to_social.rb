# frozen_string_literal: true

# Bulk copy data from the legacy `relationship` schema into the new `social` schema.
# Re-runnable: ON CONFLICT DO NOTHING. Idempotent against (follower_id, followee_id) and
# (blocker_id, blocked_id) unique constraints on social.{follows,blocks}.
#
# Mapping:
#   relationship.follows.guest_user_id  -> social.follows.follower_id
#   relationship.follows.cast_user_id   -> social.follows.followee_id
#   relationship.follows.{status,created_at,id} -> social.follows.{status,created_at,id}
#     (updated_at left equal to created_at since the source table has no such column)
#   relationship.blocks.{blocker_id,blocked_id,created_at,id} -> social.blocks.{...}
#     (blocker_type / blocked_type from cast/guest split is dropped)
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
    # Delete only rows whose (follower_id, followee_id) / (blocker_id, blocked_id) pair
    # exists in the legacy table -- preserve any new rows generated through social.v1 RPCs
    # after the up ran.
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
