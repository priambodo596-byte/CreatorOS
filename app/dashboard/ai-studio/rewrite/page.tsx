import { redirect } from 'next/navigation';

export default function RewriteRedirect() {
  redirect('/dashboard/ai-studio?mode=rewrite');
}
