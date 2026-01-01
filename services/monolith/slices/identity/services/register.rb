require 'bcrypt'
require 'jwt'

module Identity
  module Services
    class Register
      include Identity::Deps[repo: "repositories.user_repository"]

      def call(email:, password:, role:)
        # Hashing
        password_hash = BCrypt::Password.create(password)

        # DB Creation
        user = repo.create(email: email, password_hash: password_hash, role: role)

        # JWT Generation
        # TODO: Ensure JWT_SECRET is set in deployment. Do not rely on default value in production.
        payload = { sub: user.id.to_s, role: user.role, exp: Time.now.to_i + 3600 * 24 }
        token = JWT.encode(payload, ENV.fetch("JWT_SECRET", "pan1cb0at"), 'HS256')

        # Return result
        { access_token: token, user_profile: { id: user.id.to_s, email: user.email, role: user.role } }
      end
    end
  end
end
