import { next } from '@vercel/functions';

export default function middleware(request) {
  return next({ headers: { 'x-middleware-test': 'hit' } });
}
