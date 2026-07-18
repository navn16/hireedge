import { rewrite } from '@vercel/functions';

export const config = { matcher: '/' };

export default function middleware(request) {
  const host = request.headers.get('host') || '';
  if (host === 'hr.hireedge-ai.com') {
    return rewrite(new URL('/hr.html', request.url));
  }
}
