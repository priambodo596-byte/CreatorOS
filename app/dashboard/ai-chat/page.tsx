import { redirect } from 'next/navigation';

export default function AIChatRedirect() {
  redirect('/dashboard/ai-studio?mode=chat');
}
