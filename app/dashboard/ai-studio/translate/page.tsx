import { redirect } from 'next/navigation';

export default function TranslateRedirect() {
  redirect('/dashboard/ai-studio?mode=translate');
}
