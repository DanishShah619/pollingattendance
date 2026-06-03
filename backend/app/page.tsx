import { redirect } from 'next/navigation'

// Root "/" — redirect to login immediately.
// The middleware + login page will handle redirecting authenticated users
// to their role-appropriate dashboard.
export default function Home() {
  redirect('/login')
}
