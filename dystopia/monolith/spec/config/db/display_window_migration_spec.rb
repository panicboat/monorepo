# frozen_string_literal: true

RSpec.describe "post display window migration", type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:migration) do
    path = File.expand_path("../../../config/db/migrate/20261024000000_add_display_window_to_posts.rb", __dir__)
    ROM::SQL.with_gateway(Hanami.app["db.gateway"]) { eval(File.read(path), TOPLEVEL_BINDING, path) } # rubocop:disable Security/Eval
  end

  it "starts existing posts at their creation time and leaves them without an end" do
    created_at = Time.utc(2026, 1, 2, 3, 4, 5)
    id = SecureRandom.uuid_v7

    db.transaction(savepoint: true) do
      migration.apply(db, :down)
      db[:post__posts].insert(id: id, author_profile_id: SecureRandom.uuid_v7, content: "old", visibility: "public", created_at: created_at, updated_at: created_at)
      migration.apply(db, :up)

      expect(db[:post__posts].where(id: id).get([:published_at, :expires_at])).to eq([created_at, nil])
      raise Sequel::Rollback
    end
  end

  it "rejects an end that is not after the start" do
    published_at = Time.utc(2026, 1, 2, 3, 4, 5)

    expect {
      db.transaction(savepoint: true) do
        db[:post__posts].insert(id: SecureRandom.uuid_v7, author_profile_id: SecureRandom.uuid_v7, content: "bad", visibility: "public", published_at: published_at, expires_at: published_at)
      end
    }.to raise_error(Sequel::CheckConstraintViolation)
  end
end
