# frozen_string_literal: true

# Migrate visibility from 3-state (unregistered/unpublished/published)
# to 2-state (public/private) and populate registered_at
#
# Migration strategy:
# - unregistered → registered_at = NULL, visibility = "public"
# - unpublished  → registered_at = updated_at, visibility = "private"
# - published    → registered_at = updated_at, visibility = "public"

ROM::SQL.migration do
  up do
    # Set registered_at for completed onboarding casts
    run <<~SQL
      UPDATE portfolio.casts
      SET registered_at = updated_at
      WHERE visibility IN ('unpublished', 'published')
    SQL

    # Convert visibility values
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
    # Restore original visibility values
    run <<~SQL
      UPDATE portfolio.casts
      SET visibility = CASE
        WHEN registered_at IS NULL THEN 'unregistered'
        WHEN visibility = 'private' THEN 'unpublished'
        WHEN visibility = 'public' THEN 'published'
        ELSE 'unregistered'
      END
    SQL

    # Clear registered_at
    run <<~SQL
      UPDATE portfolio.casts
      SET registered_at = NULL
    SQL
  end
end
