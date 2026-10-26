# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "UPDATE profile.profiles SET registered_at = created_at WHERE registered_at IS NULL"
  end
end
