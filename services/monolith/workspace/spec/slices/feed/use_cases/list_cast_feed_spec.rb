# frozen_string_literal: true

require "spec_helper"
require_relative "../../../../slices/feed/adapters/post_adapter"
require_relative "../../../../slices/feed/adapters/cast_adapter"
require_relative "../../../../slices/feed/use_cases/list_cast_feed"

RSpec.describe "Feed::UseCases::ListCastFeed", type: :database do
  let(:use_case) { Feed::UseCases::ListCastFeed.new }
  let(:cast_id) { SecureRandom.uuid }
  let(:user_id) { SecureRandom.uuid }

  let(:db) { Hanami.app.slices[:post]["db.rom"].gateways[:default].connection }
  let(:portfolio_db) { Hanami.app.slices[:portfolio]["db.rom"].gateways[:default].connection }

  before do
    # Create a cast
    portfolio_db[:portfolio__casts].insert(
      id: cast_id,
      user_id: user_id,
      name: "My Cast",
      slug: "my-cast-#{SecureRandom.hex(4)}",
      visibility: "public",
      created_at: Time.now,
      updated_at: Time.now
    )
  end

  describe "#call" do
    before do
      # Create posts for the cast (mix of public and private)
      db[:post__posts].insert(
        id: SecureRandom.uuid, cast_id: cast_id, content: "Public post",
        visibility: "public", created_at: Time.now - 120, updated_at: Time.now
      )
      db[:post__posts].insert(
        id: SecureRandom.uuid, cast_id: cast_id, content: "Private post",
        visibility: "private", created_at: Time.now - 60, updated_at: Time.now
      )
      db[:post__posts].insert(
        id: SecureRandom.uuid, cast_id: cast_id, content: "Recent post",
        visibility: "public", created_at: Time.now, updated_at: Time.now
      )
    end

    it "returns all posts for the cast" do
      result = use_case.call(cast_id: cast_id, limit: 10)

      expect(result[:posts].size).to eq(3)
    end

    it "includes author information" do
      result = use_case.call(cast_id: cast_id, limit: 10)

      expect(result[:author]).not_to be_nil
      expect(result[:author].id).to eq(cast_id)
    end

    it "returns posts ordered by created_at desc" do
      result = use_case.call(cast_id: cast_id, limit: 10)

      expect(result[:posts].first.content).to eq("Recent post")
    end

    it "respects limit and returns has_more flag" do
      result = use_case.call(cast_id: cast_id, limit: 2)

      expect(result[:posts].size).to eq(2)
      expect(result[:has_more]).to be true
      expect(result[:next_cursor]).not_to be_nil
    end

    it "paginates correctly with cursor" do
      # First page
      page1 = use_case.call(cast_id: cast_id, limit: 2)
      expect(page1[:posts].size).to eq(2)

      # Second page
      page2 = use_case.call(cast_id: cast_id, limit: 2, cursor: page1[:next_cursor])
      expect(page2[:posts].size).to eq(1)
      expect(page2[:has_more]).to be false
    end

    context "when cast has no posts" do
      let(:empty_cast_id) { SecureRandom.uuid }

      before do
        portfolio_db[:portfolio__casts].insert(
          id: empty_cast_id,
          user_id: SecureRandom.uuid,
          name: "Empty Cast",
          slug: "empty-cast-#{SecureRandom.hex(4)}",
          visibility: "public",
          created_at: Time.now,
          updated_at: Time.now
        )
      end

      it "returns empty posts array" do
        result = use_case.call(cast_id: empty_cast_id, limit: 10)

        expect(result[:posts]).to be_empty
        expect(result[:has_more]).to be false
      end
    end
  end
end
