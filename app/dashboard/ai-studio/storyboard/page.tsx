import { redirect } from 'next/navigation';

export default function StoryboardRedirect() {
  redirect('/dashboard/ai-studio?mode=storyboard');
}
