# frozen_string_literal: true

RSpec.describe "sns links line migration", type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:migration) do
    path = File.expand_path("../../../config/db/migrate/20261101000000_drop_line_from_cast_sns_links.rb", __dir__)
    ROM::SQL.with_gateway(Hanami.app["db.gateway"]) { eval(File.read(path), TOPLEVEL_BINDING, path) } # rubocop:disable Security/Eval
  end

  it "drops the line link and keeps the other sns links" do
    with_line = create_account_with_profile(username: "sns_with_line")
    without_line = create_account_with_profile(username: "sns_without_line")
    db[:profile__casts].insert(
      profile_id: with_line, sns_links: Sequel.pg_jsonb("x" => "https://x.com/a", "line" => "https://line.me/ti/p/a")
    )
    db[:profile__casts].insert(profile_id: without_line, sns_links: Sequel.pg_jsonb("x" => "https://x.com/b"))

    db.transaction(savepoint: true) do
      migration.apply(db, :up)

      expect(db[:profile__casts].where(profile_id: [with_line, without_line]).select_hash(:profile_id, :sns_links))
        .to eq(with_line => { "x" => "https://x.com/a" }, without_line => { "x" => "https://x.com/b" })
      raise Sequel::Rollback
    end
  end
end
