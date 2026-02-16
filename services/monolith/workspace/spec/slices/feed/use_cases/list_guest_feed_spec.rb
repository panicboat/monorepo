# frozen_string_literal: true

require "spec_helper"
require_relative "../../../../slices/feed/adapters/post_adapter"
require_relative "../../../../slices/feed/adapters/relationship_adapter"
require_relative "../../../../slices/feed/adapters/cast_adapter"
require_relative "../../../../slices/feed/adapters/guest_adapter"
require_relative "../../../../slices/feed/use_cases/list_guest_feed"

RSpec.describe "Feed::UseCases::ListGuestFeed", type: :database do
  let(:use_case) { Feed::UseCases::ListGuestFeed.new }
  let(:guest_id) { SecureRandom.uuid }
  let(:cast_id) { SecureRandom.uuid }

  # Helper to create a post directly in the database
  let(:db) { Hanami.app.slices[:post]["db.rom"].gateways[:default].connection }
  let(:portfolio_db) { Hanami.app.slices[:portfolio]["db.rom"].gateways[:default].connection }

  before do
    # Create a public cast (with registered_at for public_cast_ids query)
    portfolio_db[:portfolio__casts].insert(
      id: cast_id,
      user_id: SecureRandom.uuid,
      name: "Test Cast",
      slug: "test-cast-#{SecureRandom.hex(4)}",
      visibility: "public",
      registered_at: Time.now,
      created_at: Time.now,
      updated_at: Time.now
    )
  end

  describe "#call" do
    context "with filter: all" do
      before do
        3.times do |i|
          db[:post__posts].insert(
            id: SecureRandom.uuid,
            cast_id: cast_id,
            content: "Public post #{i}",
            visibility: "public",
            created_at: Time.now - (i * 60),
            updated_at: Time.now
          )
        end
      end

      it "returns public posts from public casts" do
        result = use_case.call(guest_id: guest_id, filter: "all", limit: 10)

        expect(result[:posts]).not_to be_empty
        expect(result[:posts].map(&:visibility).uniq).to eq(["public"])
      end

      it "includes author information" do
        result = use_case.call(guest_id: guest_id, filter: "all", limit: 10)

        expect(result[:authors]).not_to be_empty
        expect(result[:authors][cast_id]).not_to be_nil
      end

      it "respects limit and returns has_more flag" do
        result = use_case.call(guest_id: guest_id, filter: "all", limit: 2)

        expect(result[:posts].size).to eq(2)
        expect(result[:has_more]).to be true
        expect(result[:next_cursor]).not_to be_nil
      end
    end

    context "with filter: following" do
      let(:follow_repo) { Hanami.app.slices[:relationship]["repositories.follow_repository"] }

      before do
        # Guest follows the cast
        follow_repo.follow(cast_id: cast_id, guest_id: guest_id)

        # Create posts for followed cast
        2.times do |i|
          db[:post__posts].insert(
            id: SecureRandom.uuid,
            cast_id: cast_id,
            content: "Followed post #{i}",
            visibility: "public",
            created_at: Time.now - (i * 60),
            updated_at: Time.now
          )
        end
      end

      it "returns posts from followed casts" do
        result = use_case.call(guest_id: guest_id, filter: "following", limit: 10)

        expect(result[:posts]).not_to be_empty
        expect(result[:posts].all? { |p| p.cast_id == cast_id }).to be true
      end

      it "returns empty when not following anyone" do
        other_guest_id = SecureRandom.uuid
        result = use_case.call(guest_id: other_guest_id, filter: "following", limit: 10)

        expect(result[:posts]).to be_empty
      end
    end

    context "with filter: favorites" do
      let(:favorite_repo) { Hanami.app.slices[:relationship]["repositories.favorite_repository"] }

      before do
        # Guest favorites the cast
        favorite_repo.add_favorite(cast_id: cast_id, guest_id: guest_id)

        # Create public posts for favorited cast
        2.times do |i|
          db[:post__posts].insert(
            id: SecureRandom.uuid,
            cast_id: cast_id,
            content: "Favorite post #{i}",
            visibility: "public",
            created_at: Time.now - (i * 60),
            updated_at: Time.now
          )
        end
      end

      it "returns posts from favorited casts" do
        result = use_case.call(guest_id: guest_id, filter: "favorites", limit: 10)

        expect(result[:posts]).not_to be_empty
        expect(result[:posts].all? { |p| p.cast_id == cast_id }).to be true
      end
    end

    context "with blocked casts" do
      let(:block_repo) { Hanami.app.slices[:relationship]["repositories.block_repository"] }
      let(:blocked_cast_id) { SecureRandom.uuid }

      before do
        # Create a blocked cast (with registered_at for public_cast_ids query)
        portfolio_db[:portfolio__casts].insert(
          id: blocked_cast_id,
          user_id: SecureRandom.uuid,
          name: "Blocked Cast",
          slug: "blocked-cast-#{SecureRandom.hex(4)}",
          visibility: "public",
          registered_at: Time.now,
          created_at: Time.now,
          updated_at: Time.now
        )

        # Block the cast
        block_repo.block(blocker_id: guest_id, blocker_type: "guest", blocked_id: blocked_cast_id, blocked_type: "cast")

        # Create posts for both casts
        db[:post__posts].insert(
          id: SecureRandom.uuid, cast_id: cast_id, content: "Normal post",
          visibility: "public", created_at: Time.now, updated_at: Time.now
        )
        db[:post__posts].insert(
          id: SecureRandom.uuid, cast_id: blocked_cast_id, content: "Blocked post",
          visibility: "public", created_at: Time.now, updated_at: Time.now
        )
      end

      it "excludes posts from blocked casts" do
        result = use_case.call(guest_id: guest_id, filter: "all", limit: 10, blocker_id: guest_id)

        expect(result[:posts].map(&:cast_id)).not_to include(blocked_cast_id)
      end
    end

    context "pagination" do
      before do
        # Create posts with different timestamps
        5.times do |i|
          db[:post__posts].insert(
            id: SecureRandom.uuid,
            cast_id: cast_id,
            content: "Post #{i}",
            visibility: "public",
            created_at: Time.now - (i * 60),
            updated_at: Time.now
          )
        end
      end

      it "paginates correctly with cursor" do
        # First page
        page1 = use_case.call(guest_id: guest_id, filter: "all", limit: 2)
        expect(page1[:posts].size).to eq(2)
        expect(page1[:has_more]).to be true

        # Second page
        page2 = use_case.call(guest_id: guest_id, filter: "all", limit: 2, cursor: page1[:next_cursor])
        expect(page2[:posts].size).to eq(2)

        # Ensure no overlap
        page1_ids = page1[:posts].map(&:id)
        page2_ids = page2[:posts].map(&:id)
        expect(page1_ids & page2_ids).to be_empty
      end
    end
  end
end
