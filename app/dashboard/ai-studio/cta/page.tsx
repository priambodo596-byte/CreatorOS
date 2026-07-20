import { redirect } from 'next/navigation';

export default function CTARedirect() {
  redirect('/dashboard/ai-studio?mode=cta');
}
