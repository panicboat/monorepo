# frozen_string_literal: true

ROM::SQL.migration do
  up do
    drop_table :"karte__reports", cascade: true
    drop_table :"karte__entries", cascade: true
    drop_table :"karte__access", cascade: true
  end

  down do
    raise Sequel::Error, "irreversible: karte entries, reports and access are not restored"
  end
end
