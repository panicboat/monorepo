# frozen_string_literal: true


ROM::SQL.migration do
  up do
    run <<~SQL
      UPDATE portfolio.casts
      SET registered_at = updated_at
      WHERE visibility IN ('unpublished', 'published')
    SQL

    run <<~SQL
      UPDATE portfolio.casts
      SET visibility = CASE
        WHEN visibility = 'unpublished' THEN 'private'
        WHEN visibility = 'published' THEN 'public'
        WHEN visibility = 'unregistered' THEN 'public'
        ELSE 'public'
      END
    SQL
  end

  down do
    run <<~SQL
      UPDATE portfolio.casts
      SET visibility = CASE
        WHEN registered_at IS NULL THEN 'unregistered'
        WHEN visibility = 'private' THEN 'unpublished'
        WHEN visibility = 'public' THEN 'published'
        ELSE 'unregistered'
      END
    SQL

    run <<~SQL
      UPDATE portfolio.casts
      SET registered_at = NULL
    SQL
  end
end
