module Portfolio
  module Relations
    class GuestPrefectures < Portfolio::DB::Relation
      schema(:"portfolio__guest_prefectures", as: :guest_prefectures, infer: false) do
        attribute :guest_user_id, Types::String
        attribute :prefecture, Types::String
        attribute :created_at, Types::Time

        associations do
          belongs_to :guest, foreign_key: :guest_user_id
        end
      end
    end
  end
end
