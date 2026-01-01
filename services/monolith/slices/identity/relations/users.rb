module Identity
  module Relations
    class Users < Identity::DB::Relation
      TABLE_NAME = if ENV['DATABASE_URL']&.start_with?('postgres')
                     Sequel[:identity][:users]
                   else
                     :identity__users
                   end

      schema(TABLE_NAME, as: :users, infer: true)
    end
  end
end
