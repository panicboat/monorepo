# frozen_string_literal: true

require "spec_helper"

RSpec.describe Social::UseCases::Posts::GetPost do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:repo) }

  let(:post_id) { "post-123" }
  let(:cast_id) { "cast-456" }
  let(:public_post) { double(:post, id: post_id, cast_id: cast_id, visibility: "public") }
  let(:private_post) { double(:post, id: post_id, cast_id: cast_id, visibility: "private") }
  let(:author) { double(:author, id: cast_id, name: "Test Cast") }

  before do
    adapter = instance_double(Social::Adapters::CastAdapter)
    allow(Social::Adapters::CastAdapter).to receive(:new).and_return(adapter)
    allow(adapter).to receive(:find_by_cast_id).with(cast_id).and_return(author)
  end

  describe "#call" do
    it "returns post with author when post exists" do
      allow(repo).to receive(:find_by_id).with(post_id).and_return(public_post)

      result = use_case.call(id: post_id)

      expect(result[:post]).to eq(public_post)
      expect(result[:author]).to eq(author)
    end

    it "returns nil when post does not exist" do
      allow(repo).to receive(:find_by_id).with(post_id).and_return(nil)

      result = use_case.call(id: post_id)

      expect(result).to be_nil
    end

    it "returns private post (access control is handled by AccessPolicy in handler)" do
      allow(repo).to receive(:find_by_id).with(post_id).and_return(private_post)

      result = use_case.call(id: post_id)

      expect(result[:post]).to eq(private_post)
      expect(result[:author]).to eq(author)
    end

    it "returns nil author when cast adapter returns nil" do
      adapter = instance_double(Social::Adapters::CastAdapter)
      allow(Social::Adapters::CastAdapter).to receive(:new).and_return(adapter)
      allow(adapter).to receive(:find_by_cast_id).with(cast_id).and_return(nil)
      allow(repo).to receive(:find_by_id).with(post_id).and_return(public_post)

      result = use_case.call(id: post_id)

      expect(result[:post]).to eq(public_post)
      expect(result[:author]).to be_nil
    end
  end
end
