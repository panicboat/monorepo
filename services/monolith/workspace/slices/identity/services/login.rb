require 'bcrypt'
require 'jwt'

module Identity
  module Services
    class Login
      include Identity::Deps[repo: "repositories.user_repository"]

      def call(phone_number:, password:)
        user = repo.find_by_phone_number(phone_number)

        unless user && BCrypt::Password.new(user.password_digest) == password
          return nil
        end

        payload = { sub: user.id, role: user.role, exp: Time.now.to_i + 3600 * 24 * 30 }
        token = JWT.encode(payload, ENV.fetch("JWT_SECRET", "pan1cb0at"), 'HS256')

        { access_token: token, user_profile: { id: user.id, phone_number: user.phone_number, role: user.role } }
      end
    end
  end
end
