# frozen_string_literal: true

ROM::SQL.migration do
  up do
    # Remove cross-schema FK: post.comments -> identity.users
    run <<-SQL
      ALTER TABLE post.comments
      DROP CONSTRAINT IF EXISTS post_comments_user_id_fkey;
    SQL

    # Remove cross-schema FK: offer.plans -> portfolio.casts
    run <<-SQL
      ALTER TABLE offer.plans
      DROP CONSTRAINT IF EXISTS cast_plans_cast_id_fkey;
    SQL

    # Remove cross-schema FK: offer.schedules -> portfolio.casts
    run <<-SQL
      ALTER TABLE offer.schedules
      DROP CONSTRAINT IF EXISTS cast_schedules_cast_id_fkey;
    SQL
  end

  down do
    # Re-add cross-schema FK: post.comments -> identity.users
    run <<-SQL
      ALTER TABLE post.comments
      ADD CONSTRAINT post_comments_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;
    SQL

    # Re-add cross-schema FK: offer.plans -> portfolio.casts
    run <<-SQL
      ALTER TABLE offer.plans
      ADD CONSTRAINT cast_plans_cast_id_fkey
      FOREIGN KEY (cast_id) REFERENCES portfolio.casts(id) ON DELETE CASCADE;
    SQL

    # Re-add cross-schema FK: offer.schedules -> portfolio.casts
    run <<-SQL
      ALTER TABLE offer.schedules
      ADD CONSTRAINT cast_schedules_cast_id_fkey
      FOREIGN KEY (cast_id) REFERENCES portfolio.casts(id) ON DELETE CASCADE;
    SQL
  end
end
