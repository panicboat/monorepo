# frozen_string_literal: true

require "spec_helper"
require "grpc"

RSpec.describe Social::UseCases::Posts::SavePost do
  let(:use_case) { described_class.new(repo: repo, contract: contract) }
  let(:repo) { double(:repo) }
  let(:contract) { Social::Contracts::SavePostContract.new }

  let(:cast_id) { "cast-123" }
  let(:post) { double(:post, id: "post-1", cast_id: cast_id, content: "Hello") }

  describe "#call - create" do
    it "creates a new post when id is nil" do
      expect(repo).to receive(:create_post)
        .with(cast_id: cast_id, content: "Hello world", visibility: "public")
        .and_return(post)
      expect(repo).to receive(:find_by_id).with("post-1").and_return(post)

      result = use_case.call(cast_id: cast_id, content: "Hello world")
      expect(result).to eq(post)
    end

    it "creates a new post when id is empty" do
      expect(repo).to receive(:create_post)
        .with(cast_id: cast_id, content: "Hello world", visibility: "public")
        .and_return(post)
      expect(repo).to receive(:find_by_id).with("post-1").and_return(post)

      result = use_case.call(cast_id: cast_id, id: "", content: "Hello world")
      expect(result).to eq(post)
    end

    it "creates a new post with visibility private" do
      expect(repo).to receive(:create_post)
        .with(cast_id: cast_id, content: "Hidden post", visibility: "private")
        .and_return(post)
      expect(repo).to receive(:find_by_id).with("post-1").and_return(post)

      result = use_case.call(cast_id: cast_id, content: "Hidden post", visibility: "private")
      expect(result).to eq(post)
    end

    it "saves media when provided" do
      media_data = [{ media_type: "image", url: "http://example.com/img.jpg" }]

      expect(repo).to receive(:create_post)
        .with(cast_id: cast_id, content: "With media", visibility: "public")
        .and_return(post)
      expect(repo).to receive(:save_media)
        .with(post_id: "post-1", media_data: media_data)
      expect(repo).to receive(:find_by_id).with("post-1").and_return(post)

      use_case.call(cast_id: cast_id, content: "With media", media: media_data)
    end
  end

  describe "#call - update" do
    let(:existing_post) { double(:existing_post, id: "post-1", cast_id: cast_id) }

    it "updates an existing post" do
      expect(repo).to receive(:find_by_id_and_cast)
        .with(id: "post-1", cast_id: cast_id)
        .and_return(existing_post)
      expect(repo).to receive(:update_post)
        .with("post-1", content: "Updated content", visibility: "public")
      expect(repo).not_to receive(:save_media)
      expect(repo).to receive(:save_hashtags).with(post_id: "post-1", hashtags: [])
      expect(repo).to receive(:find_by_id).with("post-1").and_return(post)

      result = use_case.call(cast_id: cast_id, id: "post-1", content: "Updated content")
      expect(result).to eq(post)
    end

    it "updates an existing post with media" do
      media_data = [{ media_type: "image", url: "http://example.com/img.jpg" }]

      expect(repo).to receive(:find_by_id_and_cast)
        .with(id: "post-1", cast_id: cast_id)
        .and_return(existing_post)
      expect(repo).to receive(:update_post)
        .with("post-1", content: "Updated", visibility: "public")
      expect(repo).to receive(:save_media)
        .with(post_id: "post-1", media_data: media_data)
      expect(repo).to receive(:save_hashtags).with(post_id: "post-1", hashtags: [])
      expect(repo).to receive(:find_by_id).with("post-1").and_return(post)

      use_case.call(cast_id: cast_id, id: "post-1", content: "Updated", media: media_data)
    end

    it "updates visibility of an existing post" do
      expect(repo).to receive(:find_by_id_and_cast)
        .with(id: "post-1", cast_id: cast_id)
        .and_return(existing_post)
      expect(repo).to receive(:update_post)
        .with("post-1", content: "Updated content", visibility: "private")
      expect(repo).not_to receive(:save_media)
      expect(repo).to receive(:save_hashtags).with(post_id: "post-1", hashtags: [])
      expect(repo).to receive(:find_by_id).with("post-1").and_return(post)

      result = use_case.call(cast_id: cast_id, id: "post-1", content: "Updated content", visibility: "private")
      expect(result).to eq(post)
    end

    it "raises NOT_FOUND when post does not belong to cast" do
      expect(repo).to receive(:find_by_id_and_cast)
        .with(id: "post-1", cast_id: cast_id)
        .and_return(nil)

      expect {
        use_case.call(cast_id: cast_id, id: "post-1", content: "Updated")
      }.to raise_error(GRPC::BadStatus) { |e|
        expect(e.code).to eq(GRPC::Core::StatusCodes::NOT_FOUND)
      }
    end
  end

  describe "#call - validation" do
    it "raises ValidationError when both content and media are empty" do
      expect {
        use_case.call(cast_id: cast_id, content: "")
      }.to raise_error(Social::UseCases::Posts::SavePost::ValidationError)
    end

    it "raises ValidationError when content exceeds max length" do
      expect {
        use_case.call(cast_id: cast_id, content: "a" * 5001)
      }.to raise_error(Social::UseCases::Posts::SavePost::ValidationError)
    end

    it "raises ValidationError when cast_id is missing" do
      expect {
        use_case.call(cast_id: "", content: "Hello")
      }.to raise_error(Social::UseCases::Posts::SavePost::ValidationError)
    end
  end
end
