# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/post/grpc/post_handler"

RSpec.describe Post::Grpc::PostHandler, type: :database do
  let(:notification_repo) { Hanami.app.slices[:notifications]["repositories.notification_repository"] }
  let(:author_profile_id) { create_account_with_profile }
  let(:mentioned_id) { create_account_with_profile(display_name: "Mentioned", username: "mentioned_user") }

  after { Current.clear }

  describe "#save_post mentions on a followers-only post" do
    let(:follower_id) { create_account_with_profile(display_name: "Follower", username: "follower_user") }
    let(:stranger_id) { create_account_with_profile(display_name: "Stranger", username: "stranger_user") }
    let(:visibility) { "private" }
    let(:content) { "hi @follower_user @stranger_user @#{author_username}" }
    let(:author_username) { "author_user" }
    let(:author_profile_id) { create_account_with_profile(display_name: "Author", username: author_username) }
    let(:handler) do
      message = Post::V1::SavePostRequest.new(content: content, visibility: visibility)
      described_class.new(method_key: :save_post, service: double, rpc_desc: double, active_call: double, message: message)
    end

    before do
      Social::Slice["repositories.follow_repository"].follow(follower_profile_id: follower_id, followee_profile_id: author_profile_id, status: "approved")
      stranger_id
      Current.account_id = SecureRandom.uuid_v7
      Current.profile_id = author_profile_id
    end

    def mention_types_for(profile_id)
      notification_repo.list(recipient_profile_id: profile_id).map(&:type).select { |type| type == "mention" }
    end

    it "notifies approved followers and not people who cannot see the post" do
      handler.save_post

      expect(mention_types_for(follower_id)).to eq(["mention"])
      expect(mention_types_for(stranger_id)).to be_empty
    end

    it "does not notify the author about their own mention" do
      handler.save_post

      expect(mention_types_for(author_profile_id)).to be_empty
    end

    it "still saves the post and skips only the mention whose visibility check fails" do
      allow_any_instance_of(Social::UseCases::ViewerCanSeePost).to receive(:call).and_wrap_original do |original, **args|
        raise "boom" if args[:viewer_profile_id] == stranger_id

        original.call(**args)
      end

      response = handler.save_post

      expect(response.post.id).not_to be_empty
      expect(mention_types_for(stranger_id)).to be_empty
      expect(mention_types_for(follower_id)).to eq(["mention"])
    end

    context "when the post is public" do
      let(:visibility) { "public" }

      it "notifies everyone mentioned" do
        handler.save_post

        expect(mention_types_for(follower_id)).to eq(["mention"])
        expect(mention_types_for(stranger_id)).to eq(["mention"])
      end
    end
  end

  describe "#save_post mentions" do
    let(:handler) do
      described_class.new(method_key: :save_post, service: double, rpc_desc: double, active_call: double, message: message)
    end
    let(:message) do
      Post::V1::SavePostRequest.new(content: "hi @mentioned_user", visibility: "public")
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

    it "passes the post text to the mention notification" do
      calls = []
      allow_any_instance_of(Notifications::UseCases::Emit).to receive(:call) { |_emit, **kwargs| calls << kwargs }

      handler.save_post

      expect(calls.map { |c| [c[:type], c[:excerpt]] }).to eq([["mention", "hi @mentioned_user"]])
    end

    it "collapses repeated mentions of the same profile into a single notification" do
      repeated_message = Post::V1::SavePostRequest.new(content: "@mentioned_user @mentioned_user", visibility: "public")
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

    it "lists a locked profile's public posts to everyone" do
      db[:profile__profiles].where(id: author).update(is_private: true)

      act_as(follower)
      expect(listed_ids).to contain_exactly(secret.id, open.id)

      act_as(stranger)
      expect(listed_ids).to eq([open.id])
    end
  end

  describe "counts of profiles the viewer blocks" do
    let(:post_repo) { Post::Slice["repositories.post_repository"] }
    let(:viewer) { create_account_with_profile(username: "pc_viewer") }
    let(:other) { create_account_with_profile(username: "pc_other") }
    let(:commenter) { create_account_with_profile(username: "pc_commenter") }
    let(:liker) { create_account_with_profile(username: "pc_liker") }
    let!(:counted) { post_repo.create_post(author_profile_id: create_account_with_profile(role: 2, username: "pc_author"), content: "counted", visibility: "public") }

    before do
      Post::Slice["repositories.comment_repository"].create_comment(post_id: counted.id, author_profile_id: commenter, content: "hi")
      Post::Slice["repositories.like_repository"].profile_like(post_id: counted.id, profile_id: liker)
      blocks = Social::Slice["repositories.block_repository"]
      blocks.block(blocker_profile_id: viewer, blocked_profile_id: commenter)
      blocks.block(blocker_profile_id: viewer, blocked_profile_id: liker)
    end

    def rpc(method, message)
      described_class.new(method_key: method, service: double, rpc_desc: double, active_call: double, message: message).public_send(method)
    end

    def act_as(profile_id)
      Current.account_id = SecureRandom.uuid_v7
      Current.profile_id = profile_id
    end

    def counts(proto)
      [proto.comments_count, proto.likes_count]
    end

    it "leaves them out of a single post" do
      act_as(viewer)
      expect(counts(rpc(:get_post, Post::V1::GetPostRequest.new(id: counted.id)).post)).to eq([0, 0])

      act_as(other)
      expect(counts(rpc(:get_post, Post::V1::GetPostRequest.new(id: counted.id)).post)).to eq([1, 1])
    end

    it "leaves them out of a post list" do
      act_as(viewer)
      expect(rpc(:list_posts, Post::V1::ListPostsRequest.new).posts.map { |p| counts(p) }).to eq([[0, 0]])

      act_as(other)
      expect(rpc(:list_posts, Post::V1::ListPostsRequest.new).posts.map { |p| counts(p) }).to eq([[1, 1]])
    end
  end

  describe "paging past posts the viewer cannot see" do
    let(:post_repo) { Post::Slice["repositories.post_repository"] }
    let(:viewer) { create_account_with_profile(username: "pp_viewer") }
    let(:hidden_author) { create_account_with_profile(role: 2, username: "pp_hidden") }
    let!(:shown) { post_repo.create_post(author_profile_id: create_account_with_profile(role: 2, username: "pp_shown"), content: "shown", visibility: "public", published_at: Time.now - 60) }

    before do
      2.times { |i| post_repo.create_post(author_profile_id: hidden_author, content: "hidden", visibility: "public", published_at: Time.now - (3600 * (i + 1))) }
    end

    def first_page
      response = described_class.new(method_key: :list_posts, service: double, rpc_desc: double, active_call: double, message: Post::V1::ListPostsRequest.new(limit: 1)).list_posts
      [response.posts.map(&:id), response.has_more]
    end

    it "fills the page past an author the viewer blocks and reports no more" do
      Social::Slice["repositories.block_repository"].block(blocker_profile_id: viewer, blocked_profile_id: hidden_author)
      Current.account_id = SecureRandom.uuid_v7
      Current.profile_id = viewer

      expect(first_page).to eq([[shown.id], false])
    end

    it "fills the page past a disabled author for a signed-out viewer and reports no more" do
      Hanami.app["db.gateway"].connection[:profile__profiles].where(id: hidden_author).update(disabled_at: Time.now)

      expect(first_page).to eq([[shown.id], false])
    end
  end

  describe "#save_post display window" do
    let(:post_repo) { Post::Slice["repositories.post_repository"] }
    let(:now) { Time.now }

    before do
      mentioned_id
      Current.account_id = SecureRandom.uuid_v7
      Current.profile_id = author_profile_id
    end

    def save(content: "window", published_at: "", expires_at: "")
      message = Post::V1::SavePostRequest.new(content: content, visibility: "public", published_at: published_at, expires_at: expires_at)
      described_class.new(method_key: :save_post, service: double, rpc_desc: double, active_call: double, message: message).save_post
    end

    it "takes no id, so a saved post cannot be edited" do
      expect(Post::V1::SavePostRequest.descriptor.lookup("id")).to be_nil
    end

    def expect_invalid(&block)
      expect(&block).to raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(GRPC::Core::StatusCodes::INVALID_ARGUMENT) }
    end

    it "rejects a body of only full-width spaces" do
      expect_invalid { save(content: "　") }
    end

    it "starts a post now and keeps it without an end when no window is given" do
      saved = post_repo.find_by_id(save.post.id)

      expect(saved.published_at).to be_within(5).of(now)
      expect(saved.expires_at).to be_nil
    end

    it "stores a future start and an end after it" do
      response = save(published_at: (now + 3600).iso8601, expires_at: (now + 7200).iso8601)
      saved = post_repo.find_by_id(response.post.id)

      expect([saved.published_at.to_i, saved.expires_at.to_i]).to eq([(now + 3600).to_i, (now + 7200).to_i])
      expect(Time.iso8601(response.post.published_at).to_i).to eq((now + 3600).to_i)
      expect(Time.iso8601(response.post.expires_at).to_i).to eq((now + 7200).to_i)
    end

    it "rejects a start in the past" do
      expect_invalid { save(published_at: (now - 60).iso8601) }
    end

    it "rejects an end before the start or in the past" do
      expect_invalid { save(published_at: (now + 7200).iso8601, expires_at: (now + 3600).iso8601) }
      expect_invalid { save(expires_at: (now - 60).iso8601) }
    end

    it "rejects a time it cannot read" do
      expect_invalid { save(published_at: "tomorrow") }
    end

    it "does not notify mentions on a post created as scheduled" do
      save(content: "hi @mentioned_user", published_at: (now + 3600).iso8601)

      expect(notification_repo.list(recipient_profile_id: mentioned_id).map(&:type)).not_to include("mention")
    end

    it "notifies mentions on a post created as live with an end" do
      save(content: "hi @mentioned_user", expires_at: (now + 3600).iso8601)

      expect(notification_repo.list(recipient_profile_id: mentioned_id).map(&:type)).to include("mention")
    end
  end
end
