# frozen_string_literal: true

require "spec_helper"
require "post/v1/comment_service_pb"
require "slices/post/presenters/comment_presenter"

RSpec.describe Post::Presenters::CommentPresenter do
  describe ".author_to_proto" do
    it "carries the author's username through to the proto" do
      author_info = { id: "user-1", name: "Coco", image_url: "https://example.com/a.png", username: "coco_u" }

      proto = described_class.author_to_proto(author_info)

      expect(proto.username).to eq("coco_u")
    end

    it "defaults username to an empty string when absent" do
      author_info = { id: "user-1", name: "Coco", image_url: "" }

      proto = described_class.author_to_proto(author_info)

      expect(proto.username).to eq("")
    end

    it "returns nil when author_info is nil" do
      expect(described_class.author_to_proto(nil)).to be_nil
    end
  end
end
