# frozen_string_literal: true

require "spec_helper"

RSpec.describe Messaging::UseCases::PurgeAccount do
  let(:use_case) { described_class.new(repo: repo) }
  let(:repo) { double(:messaging_repository) }

  it "deletes read_states first, then NULLs out sender_id and thread participants" do
    expect(repo).to receive(:delete_read_states_by_account).with("cast-1").ordered
    expect(repo).to receive(:null_out_sender).with("cast-1").ordered
    expect(repo).to receive(:null_out_thread_participants).with("cast-1").ordered
    use_case.call(account_id: "cast-1")
  end
end
