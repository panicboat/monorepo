'use server';

import { identityClient } from '@/lib/rpc';
import { RegisterRequest, LoginRequest, Role } from '@heaven/rpc/identity/v1/service_pb';
import { ConnectError } from '@connectrpc/connect';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function registerAction(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  // Defaulting to Role.GUEST equivalent (1) if not verified.
  // Actually Role enum is available.

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  const req = new RegisterRequest({
    email,
    password,
    role: Role.GUEST,
  });

  try {
    const res = await identityClient.register(req);
    // res.accessToken contains the JWT (if any)
    // res.userProfile contains user info

    // Set cookie (httponly)
    if (res.accessToken) {
      (await cookies()).set('token', res.accessToken, {
        httpOnly: true,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7 // 1 week
      });
    }

    // Redirect to home or onboarding
    // DO NOT redirect inside try/catch if using next/navigation redirect (it throws)
    // Actually redirect throws NEXT_REDIRECT error, so we should allow it to bubble up
    // OR return success state and let client redirect?
    // Server Actions redirect is fine if we let the error bubble.
  } catch (err) {
    if (err instanceof ConnectError) {
      return { error: err.message };
    }
    // Check if it's a redirect error (Next.js specific)
    if ((err as any).message === 'NEXT_REDIRECT') {
      throw err;
    }
    console.error(err);
    return { error: 'Failed to register' };
  }

  redirect('/home');
}

export async function loginAction(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  const req = new LoginRequest({
    email,
    password,
  });

  try {
    const res = await identityClient.login(req);

    if (res.accessToken) {
      (await cookies()).set('token', res.accessToken, {
        httpOnly: true,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7
      });
    }
  } catch (err) {
    if (err instanceof ConnectError) {
      // e.g. "unauthenticated"
      return { error: 'Invalid email or password' };
    }
    if ((err as any).message === 'NEXT_REDIRECT') {
      throw err;
    }
    console.error(err);
    return { error: 'Failed to login' };
  }

  redirect('/home');
}
