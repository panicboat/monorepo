'use server';

import { identityClient } from '@/lib/rpc';
import { RegisterRequest, LoginRequest, Role } from '@heaven/rpc/identity/v1/service_pb';
import { ConnectError } from '@connectrpc/connect';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function registerAction(prevState: unknown, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  // Defaulting to Role.GUEST equivalent (1) if not verified.

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
  } catch (err: unknown) {
    if (err instanceof ConnectError) {
      return { error: err.message };
    }
    // Check if it's a redirect error (Next.js specific)
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') {
      throw err;
    }
    console.error(err);
    return { error: 'Failed to register' };
  }

  redirect('/guest/home');
}

export async function loginAction(prevState: unknown, formData: FormData) {
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
  } catch (err: unknown) {
    if (err instanceof ConnectError) {
      // e.g. "unauthenticated"
      return { error: 'Invalid email or password' };
    }
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') {
      throw err;
    }
    console.error(err);
    return { error: 'Failed to login' };
  }

  redirect('/guest/home');
}
