export const config = { matcher: '/' };

export default function middleware(request) {
  const host = request.headers.get('host') || '';
  if (host === 'hr.hireedge-ai.com') {
    return Response.rewrite(new URL('/hr.html', request.url));
  }
}
