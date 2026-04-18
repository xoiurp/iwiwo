// app/api/auth/verify-email/route.ts
// Handler for the link in the welcome email. Marks the user as verified and
// redirects to the login page with a success flag. All error branches redirect
// to the verify page with a reason code so the UI can render a helpful state.

import { prisma } from '@/app/lib/prisma';
import { APP_URL } from '@/app/lib/email';

export const runtime = 'nodejs';

function redirect(path: string) {
  return Response.redirect(`${APP_URL}${path}`, 302);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return redirect('/conta/verificar-email?error=missing');
  }

  try {
    const record = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!record) {
      return redirect('/conta/verificar-email?error=invalid');
    }

    if (record.expires.getTime() < Date.now()) {
      // Token expired — clean up and bounce the user.
      await prisma.verificationToken
        .delete({ where: { token } })
        .catch(() => undefined);
      return redirect('/conta/verificar-email?error=invalid');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { email: record.identifier },
        data: { emailVerified: new Date() },
      }),
      prisma.verificationToken.delete({ where: { token } }),
    ]);

    return redirect('/conta/login?verified=1');
  } catch (error) {
    console.error('[auth/verify-email] unexpected error:', error);
    return redirect('/conta/verificar-email?error=invalid');
  }
}
