# frozen_string_literal: true

module Report
  module Relations
    class Reports < Report::DB::Relation
      schema(:"report__reports", as: :report_records, infer: false) do
        attribute :id, Types::String
        attribute :reporter_account_id, Types::String
        attribute :reporter_profile_id, Types::String
        attribute :reported_account_id, Types::String.optional
        attribute :reported_profile_id, Types::String.optional
        attribute :target_type, Types::String
        attribute :target_id, Types::String
        attribute :reason, Types::String
        attribute :note, Types::String
        attribute :target_content, Types::String
        attribute :handled_at, Types::Time.optional
        attribute :created_at, Types::Time

        primary_key :id
      end
    end
  end
end
