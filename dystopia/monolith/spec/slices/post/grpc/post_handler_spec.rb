# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/post/grpc/post_handler"

RSpec.describe Post::Grpc::PostHandler, type: :database do
  let(:notification_repo) { Hanami.app.slices[:notifications]["repositories.notification_repository"] }
  let(:author_profile_id) { create_account_with_profile }
  let(:mentioned_id) { create_account_with_profile(display_name: "Mentioned", username: "mentioned_user") }

  after { Current.clear }

  describe "#save_post mentions" do
    let(:handler) do
      described_class.new(method_key: :save_post, service: double, rpc_desc: double, active_call: double, message: message)
    end
    let(:message) do
      Post::V1::SavePostRequest.new(id: "", content: "hi @mentioned_user", visibility: "public")
    end

    before do
      mentioned_id
      Current.account_id = SecureRandom.uuid_v7
      Current.profile_id = author_profile_id
    end

    it "includes the resolved mention in the response" do
      response = handler.save_post

      expect(response.post.mentions.length).to eq(1)
      expect(response.post.mentions.first.profile_id).to eq(mentioned_id)
      expect(response.post.mentions.first.username).to eq("mentioned_user")
    end

    it "emits a mention notification on create" do
      handler.save_post

      notifications = notification_repo.list(recipient_profile_id: mentioned_id)
      expect(notifications.map(&:type)).to include("mention")
    end

    it "does not emit a mention notification on edit" do
      created = handler.save_post

      edit_message = Post::V1::SavePostRequest.new(id: created.post.id, content: "hi @mentioned_user again", visibility: "public")
      edit_handler = described_class.new(method_key: :save_post, service: double, rpc_desc: double, active_call: double, message: edit_message)
      edit_handler.save_post

      notifications = notification_repo.list(recipient_profile_id: mentioned_id)
      expect(notifications.map(&:type).count("mention")).to eq(1)
    end

    it "collapses repeated mentions of the same profile into a single notification" do
      repeated_message = Post::V1::SavePostRequest.new(id: "", content: "@mentioned_user @mentioned_user", visibility: "public")
      repeated_handler = described_class.new(method_key: :save_post, service: double, rpc_desc: double, active_call: double, message: repeated_message)

      repeated_handler.save_post

      notifications = notification_repo.list(recipient_profile_id: mentioned_id)
      expect(notifications.length).to eq(1)
      expect(notifications.first.actor_count).to eq(1)
    end
  end

  describe "followers-only posts" do
    let(:post_repo) { Post::Slice["repositories.post_repository"] }
    let(:follow_repo) { Social::Slice["repositories.follow_repository"] }
    let(:media_repo) { Hanami.app.slices[:media]["repositories.media_repository"] }
    let(:db) { Hanami.app["db.gateway"].connection }
    let(:author) { create_account_with_profile(role: 2, username: "fo_author") }
    let(:follower) { create_account_with_profile(username: "fo_follower") }
    let(:pending) { create_account_with_profile(username: "fo_pending") }
    let(:stranger) { create_account_with_profile(username: "fo_stranger") }
    let!(:secret) { post_repo.create_post(author_profile_id: author, content: "followers", visibility: "private") }
    let!(:open) { post_repo.create_post(author_profile_id: author, content: "everyone", visibility: "public") }

    before do
      media_id = SecureRandom.uuid_v7
      media_repo.create(id: media_id, media_type: "image", media_key: "uploads/#{media_id}.jpg")
      post_repo.save_media(post_id: secret.id, media_data: [{ media_id: media_id, media_type: "image" }])
      follow_repo.follow(follower_profile_id: follower, followee_profile_id: author, status: "approved")
      follow_repo.follow(follower_profile_id: pending, followee_profile_id: author, status: "pending")
    end

    def rpc(method, message)
      described_class.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
    end

    def act_as(profile_id)
      Current.account_id = SecureRandom.uuid_v7
      Current.profile_id = profile_id
    end

    def listed_ids(media_only: false)
      rpc(:list_posts, Post::V1::ListPostsRequest.new(author_profile_id: author, media_only: media_only)).posts.map(&:id)
    end

    it "lists them on the author's profile for the author and approved followers only" do
      [author, follower].each do |viewer|
        act_as(viewer)
        expect(listed_ids).to contain_exactly(secret.id, open.id)
      end

      [pending, stranger].each do |viewer|
        act_as(viewer)
        expect(listed_ids).to eq([open.id])
      end
    end

    it "includes them in the media list for followers only" do
      act_as(follower)
      expect(listed_ids(media_only: true)).to eq([secret.id])

      act_as(stranger)
      expect(listed_ids(media_only: true)).to eq([])
    end

    it "returns one for approved followers and raises NOT_FOUND for pending and unrelated viewers" do
      act_as(follower)
      expect(rpc(:get_post, Post::V1::GetPostRequest.new(id: secret.id)).post.id).to eq(secret.id)

      [pending, stranger].each do |viewer|
        act_as(viewer)
        expect { rpc(:get_post, Post::V1::GetPostRequest.new(id: secret.id)) }
          .to raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(GRPC::Core::StatusCodes::NOT_FOUND) }
      end
    end

    it "lists a private profile's public posts for followers only" do
      db[:profile__profiles].where(id: author).update(is_private: true)

      act_as(follower)
      expect(listed_ids).to contain_exactly(secret.id, open.id)

      act_as(stranger)
      expect(listed_ids).to eq([])
    end
  end
end
