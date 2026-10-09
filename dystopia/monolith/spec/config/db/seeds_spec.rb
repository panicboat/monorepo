# frozen_string_literal: true

require "stringio"

RSpec.describe "config/db/seeds.rb" do
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:seeds_root) { Hanami.app.root.join("config/db").to_s }

  let(:yuna_account_id) { "11111111-1111-4111-8111-111111111111" }
  let(:mio_account_id) { "22222222-2222-4222-8222-222222222222" }

  let(:seeded_tables) do
    %i[
      identity__accounts profile__profiles profile__casts karte__access
      social__follows social__blocks
      post__posts post__hashtags post__likes post__comments
    ]
  end

  let(:profile_references) do
    {
      profile__casts: %i[profile_id],
      social__follows: %i[follower_profile_id followee_profile_id],
      social__blocks: %i[blocker_profile_id blocked_profile_id],
      post__posts: %i[author_profile_id],
      post__likes: %i[profile_id],
      post__comments: %i[author_profile_id],
    }
  end

  def run_seeds
    # require_relative loads a seed file once per process, so each run forgets the files first.
    $LOADED_FEATURES.delete_if { |path| path.start_with?(seeds_root) }
    stdout, verbose = $stdout, $VERBOSE
    $stdout, $VERBOSE = StringIO.new, nil
    load File.join(seeds_root, "seeds.rb")
  ensure
    $stdout, $VERBOSE = stdout, verbose
  end

  def profiles_of(account_id)
    db[:profile__profiles].where(account_id: account_id).all
  end

  def row_counts
    seeded_tables.to_h { |table| [table, db[table].count] }
  end

  before { run_seeds }

  it "gives every seeded account at least one enabled profile" do
    accounts_without_profile = db[:identity__accounts].select_map(:id).reject do |account_id|
      profiles_of(account_id).any? { |profile| profile[:disabled_at].nil? }
    end

    expect(accounts_without_profile).to be_empty
  end

  it "gives one cast account two enabled profiles" do
    enabled = profiles_of(yuna_account_id).select { |profile| profile[:disabled_at].nil? }

    expect(enabled.size).to eq(2)
  end

  it "gives one cast account an enabled profile and a disabled profile" do
    disabled, enabled = profiles_of(mio_account_id).partition { |profile| profile[:disabled_at] }

    expect([enabled.size, disabled.size]).to eq([1, 1])
  end

  it "keeps every guest account at one profile" do
    guest_account_ids = db[:identity__accounts].where(role: 1).select_map(:id)

    expect(guest_account_ids.map { |account_id| profiles_of(account_id).size }).to all(eq(1))
  end

  it "gives every enabled profile of a cast account a post" do
    cast_account_ids = db[:identity__accounts].where(role: 2).select(:id)
    enabled_cast_profile_ids = db[:profile__profiles].where(account_id: cast_account_ids, disabled_at: nil).select_map(:id)
    authors = db[:post__posts].select_map(:author_profile_id)

    expect(enabled_cast_profile_ids - authors).to be_empty
  end

  it "points every profile reference at a seeded profile" do
    profile_ids = db[:profile__profiles].select_map(:id)

    dangling = profile_references.flat_map do |table, columns|
      columns.flat_map { |column| db[table].exclude(column => profile_ids).select_map(column) }
    end

    expect(dangling).to be_empty
  end

  it "adds no rows when it runs again" do
    before_counts = row_counts

    run_seeds

    expect(row_counts).to eq(before_counts)
  end
end
