import { redirect } from 'next/navigation';

export default function ScriptRedirect() {
  redirect('/dashboard/ai-studio?mode=script');
}
