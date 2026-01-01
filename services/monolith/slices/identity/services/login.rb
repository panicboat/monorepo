require 'bcrypt'
require 'jwt'

module Identity
  module Services
    class Login
      include Identity::Deps[repo: "repositories.user_repository"]

      def call(email:, password:)
        user = repo.find_by_email(email)

        unless user && BCrypt::Password.new(user.password_hash) == password
          return nil # or raise error
        end

        payload = { sub: user.id.to_s, role: user.role, exp: Time.now.to_i + 3600 * 24 }
        # TODO: Ensure JWT_SECRET is set in deployment.
        token = JWT.encode(payload, ENV.fetch("JWT_SECRET", "pan1cb0at"), 'HS256')

        { access_token: token, user_profile: { id: user.id.to_s, email: user.email, role: user.role } }
      end
    end
  end
end
