# frozen_string_literal: true

ROM::SQL.migration do
  up do
    run "UPDATE profile.casts SET sns_links = sns_links - 'line' WHERE sns_links ? 'line'"
  end
end
