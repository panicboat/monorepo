module Profile
  module Relations
    class GuestPrefectures < Profile::DB::Relation
      schema(:"profile__guest_prefectures", as: :guest_prefectures, infer: false) do
        attribute :guest_user_id, Types::String
        attribute :prefecture, Types::String
        attribute :created_at, Types::Time
      end
    end
  end
end
