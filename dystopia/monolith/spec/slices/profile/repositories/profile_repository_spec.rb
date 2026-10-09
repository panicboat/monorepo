# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Profile::Repositories::ProfileRepository", type: :database do
  let(:repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }
  let(:account_id) { create_account }

  def create_profile(owner: account_id, **attrs)
    repo.create({ id: SecureRandom.uuid_v7, account_id: owner, display_name: "Coco" }.merge(attrs))
  end

  describe "#find_by_id" do
    it "returns the profile by its own id" do
      profile = create_profile(username: "coco")
      expect(repo.find_by_id(profile.id).username).to eq("coco")
    end

    it "does not find a profile by its account id" do
      create_profile
      expect(repo.find_by_id(account_id)).to be_nil
    end

    it "returns nil for a value that is not a UUID" do
      expect(repo.find_by_id("not-a-uuid")).to be_nil
      expect(repo.find_by_id(nil)).to be_nil
    end
  end

  describe "#find_by_username" do
    it "matches case-insensitively" do
      profile = create_profile(username: "Coco")
      expect(repo.find_by_username("COCO").id).to eq(profile.id)
    end

    it "returns nil for blank input" do
      expect(repo.find_by_username("")).to be_nil
    end
  end

  describe "#list_by_account" do
    it "returns every profile of the account in creation order" do
      first = create_profile(created_at: Time.now - 60)
      second = create_profile(created_at: Time.now)
      create_profile(owner: create_account)

      expect(repo.list_by_account(account_id).map(&:id)).to eq([first.id, second.id])
    end

    it "returns an empty list for a value that is not a UUID" do
      expect(repo.list_by_account("sub-1")).to eq([])
    end
  end

  describe "#visible_ids_by_account" do
    it "excludes disabled profiles" do
      enabled = create_profile
      create_profile(disabled_at: Time.now)

      expect(repo.visible_ids_by_account(account_id)).to eq([enabled.id])
    end

    it "returns an empty list for a value that is not a UUID" do
      expect(repo.visible_ids_by_account("sub-1")).to eq([])
    end
  end

  describe "#username_available?" do
    let!(:profile) { create_profile(username: "coco") }

    it "is false when taken (case-insensitive)" do
      expect(repo.username_available?("COCO")).to be false
    end

    it "is true when free" do
      expect(repo.username_available?("freename")).to be true
    end

    it "excludes the given profile so it can keep its own username" do
      expect(repo.username_available?("coco", exclude_profile_id: profile.id)).to be true
    end

    it "stays false for another profile of the same account" do
      sibling = create_profile
      expect(repo.username_available?("coco", exclude_profile_id: sibling.id)).to be false
    end
  end

  describe "#locking_account" do
    let(:db) { Hanami.app["db.gateway"].connection }

    it "locks the account row before running the block" do
      log = StringIO.new
      logger = Logger.new(log)
      db.loggers << logger

      repo.locking_account(account_id) { log.puts "BLOCK" }

      expect(log.string).to match(/"identity"\."accounts".*FOR UPDATE.*BLOCK/m)
    ensure
      db.loggers.delete(logger)
    end

    it "runs the block without a lock for an id that is not a uuid" do
      expect(repo.locking_account("not-a-uuid") { :ran }).to eq(:ran)
    end
  end

  describe "#create_within_limit" do
    it "creates a profile with a new id that differs from the account id" do
      profile = repo.create_within_limit(account_id: account_id, limit: 1, attrs: { display_name: "Coco" })

      expect(profile.account_id).to eq(account_id)
      expect(profile.id).not_to eq(account_id)
    end

    it "returns nil without creating when the account is at the limit" do
      create_profile
      result = repo.create_within_limit(account_id: account_id, limit: 1, attrs: { display_name: "Second" })

      expect(result).to be_nil
      expect(repo.list_by_account(account_id).length).to eq(1)
    end

    it "counts disabled profiles toward the limit" do
      create_profile(disabled_at: Time.now)
      expect(repo.create_within_limit(account_id: account_id, limit: 1, attrs: { display_name: "Second" })).to be_nil
    end
  end

  describe "#update_profile" do
    it "updates only the addressed profile" do
      target = create_profile(display_name: "First")
      other = create_profile(display_name: "Other")

      repo.update_profile(target.id, display_name: "Second")

      expect(repo.find_by_id(target.id).display_name).to eq("Second")
      expect(repo.find_by_id(other.id).display_name).to eq("Other")
    end
  end

  describe "#save_media" do
    it "updates avatar and cover media ids" do
      profile = create_profile
      avatar = SecureRandom.uuid_v7
      cover = SecureRandom.uuid_v7

      repo.save_media(profile_id: profile.id, avatar_media_id: avatar, cover_media_id: cover)

      result = repo.find_by_id(profile.id)
      expect(result.avatar_media_id).to eq(avatar)
      expect(result.cover_media_id).to eq(cover)
    end
  end

  describe "#profile_ids_by_prefecture" do
    it "returns profile ids, not account ids" do
      profile = create_profile(prefecture: "東京都")
      create_profile(prefecture: "大阪府")

      expect(repo.profile_ids_by_prefecture("東京都")).to eq([profile.id])
    end
  end

  describe "#list_recent" do
    it "excludes the given profile ids and filters by the owning account's role" do
      cast_account = create_account(role: 2)
      cast_profile = create_profile(owner: cast_account)
      excluded = create_profile(owner: cast_account)
      create_profile

      rows = repo.list_recent(limit: 10, exclude_profile_ids: [excluded.id], role_filter: 2)

      expect(rows.map(&:id)).to eq([cast_profile.id])
    end

    it "returns the remaining profiles on the next cursor page" do
      profiles = 3.times.map do |index|
        create_account_with_profile(created_at: Time.now - index)
      end
      first_page = repo.list_recent(limit: 2).first(2)
      cursor = repo.send(:encode_cursor, {
        created_at: first_page.last.created_at.iso8601,
        id: first_page.last.id
      })

      second_page = repo.list_recent(limit: 2, cursor: cursor)

      expect(second_page.map(&:id)).to contain_exactly(*(profiles - first_page.map(&:id)))
      expect((first_page.map(&:id) & second_page.map(&:id))).to be_empty
    end

    it "returns the remaining search results on the next cursor page" do
      profiles = 3.times.map do |index|
        create_account_with_profile(
          display_name: "Cursor query #{index}",
          username: "cursor_query_#{index}",
          created_at: Time.now - index
        )
      end
      first_page = repo.search_by_query(query: "cursor_query", limit: 2).first(2)
      cursor = repo.send(:encode_cursor, {
        created_at: first_page.last.created_at.iso8601,
        id: first_page.last.id
      })

      second_page = repo.search_by_query(query: "cursor_query", limit: 2, cursor: cursor)

      expect(second_page.map(&:id)).to contain_exactly(*(profiles - first_page.map(&:id)))
      expect((first_page.map(&:id) & second_page.map(&:id))).to be_empty
    end
  end

  describe "#role_of" do
    it "returns the role of the owning account" do
      cast_account = create_account(role: 2)
      profile = create_profile(owner: cast_account)

      expect(repo.role_of(profile.id)).to eq(2)
    end

    it "returns nil for an unknown profile" do
      expect(repo.role_of(SecureRandom.uuid_v7)).to be_nil
    end
  end

  describe "#delete" do
    it "deletes the profile and no other profile of the account" do
      deleted = create_profile
      kept = create_profile

      repo.delete(deleted.id)

      expect(repo.list_by_account(account_id).map(&:id)).to eq([kept.id])
    end
  end
end
