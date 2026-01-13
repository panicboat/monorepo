module Identity
  module Relations
    class SmsVerifications < Identity::DB::Relation
      schema(:"identity__sms_verifications", as: :sms_verifications, infer: false) do
        attribute :id, Types::String
        attribute :phone_number, Types::String
        attribute :code, Types::String
        attribute :expires_at, Types::Time
        attribute :verified_at, Types::Time
        attribute :created_at, Types::Time

        primary_key :id
      end
    end
  end
end
