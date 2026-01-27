# frozen_string_literal: true

require "spec_helper"
require "grpc"

RSpec.describe Social::UseCases::Posts::DeletePost do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:repo) }

  let(:cast_id) { "cast-123" }
  let(:post_id) { "post-1" }
  let(:post) { double(:post, id: post_id, cast_id: cast_id) }

  describe "#call" do
    it "deletes the post when it belongs to the cast" do
      expect(repo).to receive(:find_by_id_and_cast)
        .with(id: post_id, cast_id: cast_id)
        .and_return(post)
      expect(repo).to receive(:delete_post).with(post_id)

      use_case.call(cast_id: cast_id, post_id: post_id)
    end

    it "raises NOT_FOUND when post does not exist" do
      expect(repo).to receive(:find_by_id_and_cast)
        .with(id: post_id, cast_id: cast_id)
        .and_return(nil)

      expect {
        use_case.call(cast_id: cast_id, post_id: post_id)
      }.to raise_error(GRPC::BadStatus) { |e|
        expect(e.code).to eq(GRPC::Core::StatusCodes::NOT_FOUND)
      }
    end

    it "raises NOT_FOUND when post belongs to another cast" do
      expect(repo).to receive(:find_by_id_and_cast)
        .with(id: post_id, cast_id: "other-cast")
        .and_return(nil)

      expect {
        use_case.call(cast_id: "other-cast", post_id: post_id)
      }.to raise_error(GRPC::BadStatus) { |e|
        expect(e.code).to eq(GRPC::Core::StatusCodes::NOT_FOUND)
      }
    end
  end
end
