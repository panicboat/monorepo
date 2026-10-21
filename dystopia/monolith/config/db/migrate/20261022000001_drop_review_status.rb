# frozen_string_literal: true

ROM::SQL.migration do
  up do
    alter_table(:"review__reviews") do
      drop_constraint :closed_review_rated
      drop_constraint :closed_at_matches_status
      drop_constraint :status_value
      drop_column :closed_at
      drop_column :status
    end
    run "DROP INDEX IF EXISTS review.idx_review_reviews_summary"
    run <<~SQL
      CREATE INDEX idx_review_reviews_summary
        ON review.reviews (target_profile_id, author_profile_id)
        WHERE rating IS NOT NULL
    SQL
  end

  down do
    raise Sequel::Error, "irreversible: review statuses are not restored"
  end
end
