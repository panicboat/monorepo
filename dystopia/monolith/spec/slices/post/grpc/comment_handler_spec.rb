# frozen_string_literal: true

require "spec_helper"
require "slices/post/grpc/comment_handler"

RSpec.describe Post::Grpc::CommentHandler, type: :database do
  let(:handler) do
    described_class.new(
      method_key: :test,
      service: double,
      rpc_desc: double,
      active_call: double,
      message: double(:message)
    )
  end
  let(:profile_repo) { Hanami.app.slices[:profile]["repositories.profile_repository"] }

  describe "#get_comment_author" do
    it "includes the author's username" do
      user_id = SecureRandom.uuid_v7
      profile_repo.create(account_id: user_id, display_name: "Coco", username: "coco_u")

      author = handler.send(:get_comment_author, user_id)

      expect(author[:username]).to eq("coco_u")
    end

    it "returns nil when the profile cannot be resolved" do
      author = handler.send(:get_comment_author, SecureRandom.uuid_v7)

      expect(author).to be_nil
    end
  end
end
