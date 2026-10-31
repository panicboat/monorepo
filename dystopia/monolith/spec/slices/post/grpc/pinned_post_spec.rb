# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/post/grpc/post_handler"

RSpec.describe "pinned post", type: :database do
  let(:post_repo) { Post::Slice["repositories.post_repository"] }
  let(:follow_repo) { Social::Slice["repositories.follow_repository"] }
  let(:author) { create_account_with_profile(role: 2, username: "pin_author") }
  let(:other_profile) { create_account_with_profile(username: "pin_other") }
  let(:follower) { create_account_with_profile(username: "pin_follower") }
  let(:now) { Time.now }
  let!(:oldest) { post_repo.create_post(author_profile_id: author, content: "oldest", visibility: "public", published_at: now - 7200) }
  let!(:middle) { post_repo.create_post(author_profile_id: author, content: "middle", visibility: "public", published_at: now - 3600) }
  let!(:newest) { post_repo.create_post(author_profile_id: author, content: "newest", visibility: "public", published_at: now - 60) }

  before { follow_repo.follow(follower_profile_id: follower, followee_profile_id: author, status: "approved") }

  after { Current.clear }

  def rpc(method, message)
    Post::Grpc::PostHandler.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
  end

  def act_as(profile_id)
    Current.account_id = SecureRandom.uuid_v7
    Current.profile_id = profile_id
  end

  def pin(id)
    rpc(:pin_post, Post::V1::PinPostRequest.new(id: id))
  end

  def unpin(id)
    rpc(:unpin_post, Post::V1::UnpinPostRequest.new(id: id))
  end

  def list(**params)
    rpc(:list_posts, Post::V1::ListPostsRequest.new(author_profile_id: author, **params))
  end

  def get_post(id)
    rpc(:get_post, Post::V1::GetPostRequest.new(id: id)).post
  end

  def expect_code(code, &block)
    expect(&block).to raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(code) }
  end

  describe "the profile list" do
    it "puts the pinned post first and keeps the rest newest first without repeating it" do
      act_as(author)
      pin(oldest.id)

      expect(list.posts.map(&:id)).to eq([oldest.id, newest.id, middle.id])
    end

    it "marks only the pinned post as pinned" do
      act_as(author)
      pin(middle.id)

      expect(list.posts.to_h { |p| [p.id, p.pinned] }).to eq(oldest.id => false, middle.id => true, newest.id => false)
    end

    it "keeps the media list in its usual order" do
      media_post = post_repo.create_post(author_profile_id: author, content: "media", visibility: "public", published_at: now - 5000)
      newer_media_post = post_repo.create_post(author_profile_id: author, content: "media2", visibility: "public", published_at: now - 30)
      [media_post, newer_media_post].each do |p|
        post_repo.save_media(post_id: p.id, media_data: [{ media_id: SecureRandom.uuid_v7, media_type: "image" }])
      end
      act_as(author)
      pin(media_post.id)

      expect(list(media_only: true).posts.map(&:id)).to eq([newer_media_post.id, media_post.id])
    end

    it "does not count the pinned post toward the page and does not repeat it on later pages" do
      act_as(author)
      pin(oldest.id)

      first = list(limit: 1)
      expect(first.posts.map(&:id)).to eq([oldest.id, newest.id])
      expect(first.has_more).to be true

      second = list(limit: 1, cursor: first.next_cursor)
      expect(second.posts.map(&:id)).to eq([middle.id])
      expect(second.has_more).to be false
    end

    it "returns the pinned post alone when it is the only post" do
      other = create_account_with_profile(username: "pin_single")
      only = post_repo.create_post(author_profile_id: other, content: "only", visibility: "public", published_at: now - 60)
      act_as(other)
      pin(only.id)

      response = rpc(:list_posts, Post::V1::ListPostsRequest.new(author_profile_id: other))

      expect(response.posts.map(&:id)).to eq([only.id])
      expect(response.has_more).to be false
    end
  end

  describe "a pinned post the viewer cannot read" do
    def pinned_with(**attributes)
      post_repo.create_post(author_profile_id: author, content: "pinned", visibility: "public", published_at: now - 10, **attributes).tap do |post|
        act_as(author)
        pin(post.id)
      end
    end

    it "shows a followers only post first to the author and a follower" do
      post = pinned_with(visibility: "private")

      [author, follower].each do |viewer|
        act_as(viewer)
        expect(list.posts.first.id).to eq(post.id)
      end
    end

    it "hides a followers only post from other viewers and leaves the usual list" do
      pinned_with(visibility: "private")

      act_as(other_profile)

      expect(list.posts.map(&:id)).to eq([newest.id, middle.id, oldest.id])
    end

    it "shows a scheduled post first only to the author" do
      post = pinned_with(published_at: now + 3600)

      act_as(author)
      expect(list.posts.first.id).to eq(post.id)

      act_as(follower)
      expect(list.posts.map(&:id)).to eq([newest.id, middle.id, oldest.id])
    end

    it "shows an expired post first only to the author" do
      post = pinned_with(published_at: now - 7200, expires_at: now - 3600)

      act_as(author)
      expect(list.posts.first.id).to eq(post.id)

      act_as(follower)
      expect(list.posts.map(&:id)).to eq([newest.id, middle.id, oldest.id])
    end
  end

  describe "pinning" do
    it "replaces the post pinned before" do
      act_as(author)
      pin(oldest.id)
      pin(middle.id)

      expect(get_post(oldest.id).pinned).to be false
      expect(get_post(middle.id).pinned).to be true
    end

    it "keeps one pinned post per profile" do
      second_profile = create_account_with_profile(username: "pin_second")
      theirs = post_repo.create_post(author_profile_id: second_profile, content: "theirs", visibility: "public", published_at: now - 60)
      act_as(author)
      pin(oldest.id)
      act_as(second_profile)
      pin(theirs.id)

      expect(get_post(theirs.id).pinned).to be true
      expect(get_post(oldest.id).pinned).to be true
    end

    it "accepts pinning the same post again" do
      act_as(author)
      pin(oldest.id)
      pin(oldest.id)

      expect(get_post(oldest.id).pinned).to be true
    end

    it "keeps the published time of the post" do
      act_as(author)
      before_pin = post_repo.find_by_id(oldest.id).published_at
      pin(oldest.id)

      expect(post_repo.find_by_id(oldest.id).published_at).to eq(before_pin)
    end

    it "rejects another profile's post" do
      act_as(other_profile)

      expect_code(GRPC::Core::StatusCodes::NOT_FOUND) { pin(oldest.id) }
      expect(post_repo.find_by_id(oldest.id).pinned_at).to be_nil
    end

    it "requires a signed in profile" do
      expect_code(GRPC::Core::StatusCodes::UNAUTHENTICATED) { pin(oldest.id) }
    end
  end

  describe "unpinning" do
    it "returns the post to its place in the list" do
      act_as(author)
      pin(oldest.id)
      unpin(oldest.id)

      expect(list.posts.map(&:id)).to eq([newest.id, middle.id, oldest.id])
      expect(get_post(oldest.id).pinned).to be false
    end

    it "accepts a post that is not pinned" do
      act_as(author)

      expect { unpin(oldest.id) }.not_to raise_error
    end

    it "rejects another profile's post and leaves the pin" do
      act_as(author)
      pin(oldest.id)
      act_as(other_profile)

      expect_code(GRPC::Core::StatusCodes::NOT_FOUND) { unpin(oldest.id) }
      expect(post_repo.find_by_id(oldest.id).pinned_at).not_to be_nil
    end
  end

  describe "deleting the pinned post" do
    it "does not promote another post" do
      act_as(author)
      pin(oldest.id)
      rpc(:delete_post, Post::V1::DeletePostRequest.new(id: oldest.id))

      expect(list.posts.map(&:id)).to eq([newest.id, middle.id])
      expect(list.posts.map(&:pinned)).to all(be false)
    end
  end
end
