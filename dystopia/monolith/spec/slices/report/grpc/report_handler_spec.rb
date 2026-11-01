# frozen_string_literal: true

require "spec_helper"
require "lib/current"
require "slices/report/grpc/report_handler"

RSpec.describe Report::Grpc::ReportHandler, type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }
  let(:post_repo) { Post::Slice["repositories.post_repository"] }
  let(:comment_repo) { Post::Slice["repositories.comment_repository"] }
  let(:messaging_repo) { Messaging::Slice["repositories.messaging_repository"] }

  let(:reporter_account) { create_account(role: 1) }
  let(:reporter) { create_account_with_profile(account_id: reporter_account, username: "report_reporter") }
  let(:reported_account) { create_account(role: 2) }
  let(:reported) { create_account_with_profile(account_id: reported_account, username: "report_reported", display_name: "Reported", bio: "my bio") }
  let(:the_post) { post_repo.create_post(author_profile_id: reported, content: "abusive post", visibility: "public") }

  def report(target_type:, target_id:, reason: "defamation", note: "")
    message = ::Report::V1::CreateReportRequest.new(target_type: target_type, target_id: target_id, reason: reason, note: note)
    described_class.new(method_key: :create_report, service: double, rpc_desc: double, active_call: double, message: message).create_report
  end

  def act_as(account_id, profile_id)
    Current.account_id = account_id
    Current.profile_id = profile_id
  end

  def status(code)
    raise_error(GRPC::BadStatus) { |e| expect(e.code).to eq(code) }
  end

  def reports
    db[:report__reports]
  end

  before { act_as(reporter_account, reporter) }
  after { Current.clear }

  it "requires a signed-in profile" do
    Current.clear

    expect { report(target_type: "post", target_id: the_post.id) }.to status(GRPC::Core::StatusCodes::UNAUTHENTICATED)
  end

  describe "a post" do
    it "stores the reporter, the reported account and profile, the reason, the note and the content as unhandled" do
      report(target_type: "post", target_id: the_post.id, reason: "threat", note: "  repeated  ")

      row = reports.first
      expect(row).to include(
        reporter_account_id: reporter_account,
        reporter_profile_id: reporter,
        reported_account_id: reported_account,
        reported_profile_id: reported,
        target_type: "post",
        target_id: the_post.id,
        reason: "threat",
        note: "repeated",
        target_content: "abusive post",
        handled_at: nil
      )
    end

    it "keeps the content written at the time of the report after the post is deleted" do
      report(target_type: "post", target_id: the_post.id)

      post_repo.delete_post(the_post.id)

      expect(reports.select_map(:target_content)).to eq(["abusive post"])
    end

    it "rejects a post the reporter cannot read" do
      Social::Slice["repositories.block_repository"].block(blocker_profile_id: reported, blocked_profile_id: reporter)

      expect { report(target_type: "post", target_id: the_post.id) }.to status(GRPC::Core::StatusCodes::NOT_FOUND)
      expect(reports.count).to eq(0)
    end

    it "rejects a post that does not exist" do
      expect { report(target_type: "post", target_id: SecureRandom.uuid_v7) }.to status(GRPC::Core::StatusCodes::NOT_FOUND)
    end
  end

  describe "repeated reports" do
    it "keeps one row and the first answers when the same profile reports the same target again" do
      report(target_type: "post", target_id: the_post.id, reason: "threat", note: "first")

      expect { report(target_type: "post", target_id: the_post.id, reason: "other", note: "second") }.not_to raise_error

      expect(reports.select_map([:reason, :note])).to eq([["threat", "first"]])
    end

    it "keeps a row for each profile that reports the same target" do
      report(target_type: "post", target_id: the_post.id)

      other_account = create_account(role: 1)
      act_as(other_account, create_account_with_profile(account_id: other_account, username: "report_other"))
      report(target_type: "post", target_id: the_post.id)

      expect(reports.count).to eq(2)
    end
  end

  describe "invalid input" do
    it "rejects an unknown reason" do
      expect { report(target_type: "post", target_id: the_post.id, reason: "spam") }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    end

    it "rejects an unknown target type" do
      expect { report(target_type: "schedule", target_id: the_post.id) }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    end

    it "rejects a target id that is not a uuid" do
      expect { report(target_type: "post", target_id: "not-a-uuid") }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    end

    it "accepts a note of 200 characters and rejects a longer one" do
      expect { report(target_type: "post", target_id: the_post.id, note: "あ" * 200) }.not_to raise_error
      expect { report(target_type: "profile", target_id: reported, note: "あ" * 201) }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    end
  end

  describe "the reporter's own content" do
    it "rejects the reporter's own post" do
      own_post = post_repo.create_post(author_profile_id: reporter, content: "mine", visibility: "public")

      expect { report(target_type: "post", target_id: own_post.id) }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    end

    it "rejects another profile of the reporter's account" do
      other_profile = create_account_with_profile(account_id: reporter_account, username: "report_second")

      expect { report(target_type: "profile", target_id: other_profile) }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    end
  end

  describe "a comment" do
    let(:comment) { comment_repo.create_comment(post_id: the_post.id, author_profile_id: reported, content: "abusive comment") }

    it "stores the comment's author and content" do
      report(target_type: "comment", target_id: comment.id)

      expect(reports.first).to include(target_type: "comment", reported_profile_id: reported, target_content: "abusive comment")
    end

    it "rejects a comment on a post the reporter cannot read" do
      comment
      Social::Slice["repositories.block_repository"].block(blocker_profile_id: reported, blocked_profile_id: reporter)

      expect { report(target_type: "comment", target_id: comment.id) }.to status(GRPC::Core::StatusCodes::NOT_FOUND)
    end
  end

  describe "a message" do
    let(:thread) { messaging_repo.upsert_thread(profile_a: [reporter, reported].min, profile_b: [reporter, reported].max) }
    let(:message) { messaging_repo.insert_message(thread_id: thread[:id], sender_profile_id: reported, content: "abusive dm") }

    it "stores the sender and the content for a participant" do
      report(target_type: "message", target_id: message[:id])

      expect(reports.first).to include(target_type: "message", reported_profile_id: reported, target_content: "abusive dm")
    end

    it "rejects a message in a thread the reporter is not part of" do
      other_account = create_account(role: 1)
      act_as(other_account, create_account_with_profile(account_id: other_account, username: "report_outsider"))

      expect { report(target_type: "message", target_id: message[:id]) }.to status(GRPC::Core::StatusCodes::NOT_FOUND)
    end

    it "rejects the reporter's own message" do
      own = messaging_repo.insert_message(thread_id: thread[:id], sender_profile_id: reporter, content: "mine")

      expect { report(target_type: "message", target_id: own[:id]) }.to status(GRPC::Core::StatusCodes::INVALID_ARGUMENT)
    end
  end

  describe "a review" do
    let(:guest_account) { create_account(role: 1) }
    let(:guest) { create_account_with_profile(account_id: guest_account, username: "report_guest") }
    let(:review) do
      created = Review::Slice["repositories.review_repository"].create(author_account_id: guest_account, author_profile_id: guest, target_profile_id: reported, rating: 1, occurred_on: "2026-10-01")
      Review::Slice["repositories.event_repository"].create(review_id: created.id, stage: "service", outcome: "bad", tags: ["rude"], note: "abusive review", occurred_on: "2026-10-01")
      created
    end

    it "stores the author, the rating and the events" do
      act_as(reported_account, reported)

      report(target_type: "review", target_id: review.id)

      row = reports.first
      expect(row).to include(target_type: "review", reported_account_id: guest_account, reported_profile_id: guest)
      expect(row[:target_content]).to include("rating: 1", "2026-10-01", "service", "bad", "rude", "abusive review")
    end

    it "rejects a review the reporter cannot read" do
      Social::Slice["repositories.block_repository"].block(blocker_profile_id: reported, blocked_profile_id: reporter)

      expect { report(target_type: "review", target_id: review.id) }.to status(GRPC::Core::StatusCodes::NOT_FOUND)
    end
  end

  describe "a karte" do
    let(:cast_account) { create_account(role: 2) }
    let(:cast) { create_account_with_profile(account_id: cast_account, username: "report_cast") }
    let(:karte) do
      created = Karte::Slice["repositories.karte_repository"].create(author_account_id: reported_account, author_profile_id: reported, target_profile_id: reporter, rating: 2, occurred_on: "2026-10-01")
      Karte::Slice["repositories.event_repository"].create(karte_id: created.id, stage: "reservation", outcome: "no_show", tags: [], note: "false karte", occurred_on: "2026-10-01")
      created
    end

    it "stores the author, the rating and the events for a cast" do
      act_as(cast_account, cast)

      report(target_type: "karte", target_id: karte.id)

      row = reports.first
      expect(row).to include(target_type: "karte", reported_account_id: reported_account, reported_profile_id: reported)
      expect(row[:target_content]).to include("rating: 2", "reservation", "no_show", "false karte")
    end

    it "rejects a guest, who cannot read kartes" do
      expect { report(target_type: "karte", target_id: karte.id) }.to status(GRPC::Core::StatusCodes::NOT_FOUND)
    end
  end

  describe "a profile" do
    it "stores the display name and the bio" do
      report(target_type: "profile", target_id: reported)

      row = reports.first
      expect(row).to include(target_type: "profile", reported_account_id: reported_account, reported_profile_id: reported)
      expect(row[:target_content]).to include("Reported", "my bio")
    end

    it "accepts a profile the reporter has blocked" do
      Social::Slice["repositories.block_repository"].block(blocker_profile_id: reporter, blocked_profile_id: reported)

      expect { report(target_type: "profile", target_id: reported) }.not_to raise_error
    end

    it "rejects a profile that is not visible" do
      db[:profile__profiles].where(id: reported).update(disabled_at: Time.now)

      expect { report(target_type: "profile", target_id: reported) }.to status(GRPC::Core::StatusCodes::NOT_FOUND)
    end
  end

  it "keeps the report after the profiles of the reporter and the reported are purged" do
    report(target_type: "profile", target_id: reported)

    Profile::Slice["use_cases.purge_profile"].call(profile_id: reported)
    Profile::Slice["use_cases.purge_profile"].call(profile_id: reporter)

    expect(reports.first).to include(reporter_account_id: reporter_account, reported_account_id: reported_account, target_content: include("my bio"))
  end
end
