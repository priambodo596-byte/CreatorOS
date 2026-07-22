import { redirect } from 'next/navigation';

export default function HooksRedirect() {
  redirect('/dashboard/ai-studio?mode=hooks');
}
