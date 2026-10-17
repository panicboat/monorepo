# frozen_string_literal: true

RSpec.describe "review schema", type: :database do
  let(:db) { Hanami.app["db.gateway"].connection }

  def insert(**attrs)
    db.transaction(savepoint: true) do
      db[:review__reviews].insert({
        id: SecureRandom.uuid_v7, author_account_id: SecureRandom.uuid_v7, author_profile_id: SecureRandom.uuid_v7,
        target_profile_id: SecureRandom.uuid_v7, status: "open", last_occurred_on: Date.new(2026, 10, 1)
      }.merge(attrs))
    end
  end

  it "holds the lifecycle tables" do
    tables = db[Sequel[:information_schema][:tables]].where(table_schema: "review").select_map(:table_name)

    expect(tables).to include("reviews", "events")
  end

  it "refuses a rating outside 1..5, an unknown status and a closed review without a rating or a closing time" do
    expect { insert(rating: 6) }.to raise_error(Sequel::CheckConstraintViolation)
    expect { insert(status: "draft") }.to raise_error(Sequel::CheckConstraintViolation)
    expect { insert(status: "closed", closed_at: Time.now) }.to raise_error(Sequel::CheckConstraintViolation)
    expect { insert(status: "closed", rating: 3) }.to raise_error(Sequel::CheckConstraintViolation)
    expect { insert(status: "open", rating: 3, closed_at: Time.now) }.to raise_error(Sequel::CheckConstraintViolation)
  end

  it "refuses an unknown stage and removes the events with their review" do
    id = insert
    event = { review_id: id, outcome: "booked", occurred_on: Date.new(2026, 10, 1) }

    expect { db.transaction(savepoint: true) { db[:review__events].insert(event.merge(id: SecureRandom.uuid_v7, stage: "payment")) } }.to raise_error(Sequel::CheckConstraintViolation)
    db[:review__events].insert(event.merge(id: SecureRandom.uuid_v7, stage: "service"))
    db[:review__reviews].where(id: id).delete

    expect(db[:review__events].where(review_id: id).count).to eq(0)
  end
end
