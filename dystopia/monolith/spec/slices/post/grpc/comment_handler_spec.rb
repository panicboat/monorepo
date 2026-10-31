# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/post/grpc/comment_handler"

RSpec.describe Post::Grpc::CommentHandler, type: :database do
  describe "#get_comment_author" do
    let(:handler) do
      described_class.new(
        method_key: :test,
        service: double,
        rpc_desc: double,
        active_call: double,
        message: double(:message)
      )
    end

    it "includes the author's username" do
      author_profile_id = create_account_with_profile(display_name: "Coco", username: "coco_u")

      author = handler.send(:get_comment_author, author_profile_id)

      expect(author.username).to eq("coco_u")
    end

    it "returns nil when the profile cannot be resolved" do
      author = handler.send(:get_comment_author, SecureRandom.uuid_v7)

      expect(author).to be_nil
    end
  end

  it "offers no way to delete a comment or to list the comments of an author" do
    expect(described_class.rpc_descs.keys.map(&:to_s)).to contain_exactly("AddComment", "ListComments", "ListReplies")
  end

  describe "#list_comments for a signed-out viewer" do
    let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }
    let(:comment_repo) { Hanami.app.slices[:post]["repositories.comment_repository"] }

    after { Current.clear }

    it "fills the page past comments of a disabled author and reports no more" do
      db = Hanami.app["db.gateway"].connection
      post = post_repo.create_post(author_profile_id: create_account_with_profile(username: "lcso_author"), content: "post")
      hidden = create_account_with_profile(username: "lcso_hidden")
      shown = comment_repo.create_comment(post_id: post.id, author_profile_id: create_account_with_profile(username: "lcso_shown"), content: "shown")
      db[:post__comments].where(id: shown.id).update(created_at: Time.now - 60)
      2.times do |i|
        hidden_comment = comment_repo.create_comment(post_id: post.id, author_profile_id: hidden, content: "hidden")
        db[:post__comments].where(id: hidden_comment.id).update(created_at: Time.now - (3600 * (i + 1)))
      end
      db[:profile__profiles].where(id: hidden).update(disabled_at: Time.now)
      first_page = described_class.new(
        method_key: :list_comments, service: double, rpc_desc: double, active_call: double,
        message: Post::V1::ListCommentsRequest.new(post_id: post.id, limit: 1)
      ).list_comments

      expect([first_page.comments.map(&:id), first_page.has_more]).to eq([[shown.id], false])
    end
  end

  describe "#add_comment mentions" do
    let(:handler) do
      described_class.new(method_key: :add_comment, service: double, rpc_desc: double, active_call: double, message: message)
    end
    let(:message) { Post::V1::AddCommentRequest.new(post_id: post.id, content: "hi @mentioned_user") }
    let(:author_profile_id) { create_account_with_profile }
    let(:mentioned_id) { create_account_with_profile(display_name: "Mentioned", username: "mentioned_user") }
    let(:post) { post_repo.create_post(author_profile_id: create_account_with_profile, content: "post") }
    let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }

    before do
      mentioned_id
      Current.account_id = SecureRandom.uuid_v7
      Current.profile_id = author_profile_id
    end

    after { Current.clear }

    it "resolves the mentioned username in the response" do
      response = handler.add_comment

      expect(response.comment.mentions.length).to eq(1)
      expect(response.comment.mentions.first.username).to eq("mentioned_user")
    end
  end

  describe "#add_comment mentions on a followers-only post" do
    let(:handler) do
      message = Post::V1::AddCommentRequest.new(post_id: post.id, content: "hi @follower_user @stranger_user @author_user")
      described_class.new(method_key: :add_comment, service: double, rpc_desc: double, active_call: double, message: message)
    end
    let(:notification_repo) { Hanami.app.slices[:notifications]["repositories.notification_repository"] }
    let(:post_repo) { Hanami.app.slices[:post]["repositories.post_repository"] }
    let(:author_profile_id) { create_account_with_profile(display_name: "Author", username: "author_user") }
    let(:follower_id) { create_account_with_profile(display_name: "Follower", username: "follower_user") }
    let(:stranger_id) { create_account_with_profile(display_name: "Stranger", username: "stranger_user") }
    let(:visibility) { "private" }
    let(:post) { post_repo.create_post(author_profile_id: author_profile_id, content: "post", visibility: visibility) }

    before do
      Social::Slice["repositories.follow_repository"].follow(follower_profile_id: follower_id, followee_profile_id: author_profile_id, status: "approved")
      stranger_id
      Current.account_id = SecureRandom.uuid_v7
      Current.profile_id = author_profile_id
    end

    after { Current.clear }

    def mention_types_for(profile_id)
      notification_repo.list(recipient_profile_id: profile_id).map(&:type).select { |type| type == "mention" }
    end

    it "notifies approved followers and not people who cannot see the post" do
      handler.add_comment

      expect(mention_types_for(follower_id)).to eq(["mention"])
      expect(mention_types_for(stranger_id)).to be_empty
    end

    it "does not notify the author about their own mention" do
      handler.add_comment

      expect(mention_types_for(author_profile_id)).to be_empty
    end

    context "when the post is public" do
      let(:visibility) { "public" }

      it "notifies everyone mentioned" do
        handler.add_comment

        expect(mention_types_for(follower_id)).to eq(["mention"])
        expect(mention_types_for(stranger_id)).to eq(["mention"])
      end
    end
  end
end
