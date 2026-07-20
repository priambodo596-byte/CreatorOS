export const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

export const FEATURES = [
  {
    icon: 'Search',
    title: 'AI Trend Research',
    description:
      'Discover viral topics, analyze competitors, and find keyword opportunities before anyone else.',
    color: 'primary',
  },
  {
    icon: 'PenLine',
    title: 'Script Generator',
    description:
      'Generate engaging, retention-optimized scripts with hooks, CTAs, and natural pacing in seconds.',
    color: 'accent',
  },
  {
    icon: 'Image',
    title: 'Thumbnail Studio',
    description:
      'Create click-worthy thumbnails with AI, then A/B test variations to maximize your CTR.',
    color: 'info',
  },
  {
    icon: 'Video',
    title: 'Video Editor',
    description:
      'AI-powered timeline editor with auto-captions, B-roll suggestions, and smart cuts.',
    color: 'success',
  },
  {
    icon: 'TrendingUp',
    title: 'SEO Optimizer',
    description:
      'Titles, descriptions, tags, and hashtags — all optimized for YouTube search and discovery.',
    color: 'warning',
  },
  {
    icon: 'Upload',
    title: 'Auto Publishing',
    description:
      'Schedule, publish, and manage uploads with AI-scored checklists and viral predictions.',
    color: 'primary',
  },
];

export const STEPS = [
  {
    number: '01',
    title: 'Research & Discover',
    description:
      'AI scans trends, competitors, and keywords to surface the best content opportunities for your channel.',
    icon: 'Search',
  },
  {
    number: '02',
    title: 'Create with AI',
    description:
      'Generate scripts, storyboards, thumbnails, and SEO metadata — all tailored to your brand voice.',
    icon: 'Sparkles',
  },
  {
    number: '03',
    title: 'Edit & Produce',
    description:
      'Use the AI video editor for captions, B-roll, music, and smart cuts. Export in any format.',
    icon: 'Film',
  },
  {
    number: '04',
    title: 'Publish & Analyze',
    description:
      'Schedule uploads, track performance, and get AI recommendations to improve your next video.',
    icon: 'Rocket',
  },
];

export const PRICING = [
  {
    name: 'Starter',
    price: 0,
    period: 'forever',
    description: 'Perfect for getting started with AI-powered content creation.',
    features: [
      '5 AI script generations / month',
      'Basic trend research',
      'Thumbnail generator (3 / month)',
      'SEO optimizer (basic)',
      '1 workspace',
      'Community support',
    ],
    cta: 'Start Free',
    popular: false,
  },
  {
    name: 'Creator',
    price: 29,
    period: 'month',
    description: 'Everything you need to grow your channel with AI.',
    features: [
      'Unlimited AI script generations',
      'Advanced trend & competitor research',
      'Unlimited thumbnail generation',
      'Full SEO suite',
      'Video editor with AI captions',
      'Auto-publishing & scheduling',
      '5 team members',
      'Priority support',
    ],
    cta: 'Start 14-Day Trial',
    popular: true,
  },
  {
    name: 'Agency',
    price: 99,
    period: 'month',
    description: 'Scale content production across multiple channels.',
    features: [
      'Everything in Creator',
      'Unlimited team members',
      'Multi-channel management',
      'Workflow automation & AI agents',
      'API access',
      'Custom AI model training',
      'White-label reports',
      'Dedicated account manager',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];

export const TESTIMONIALS = [
  {
    name: 'Marcus Chen',
    role: 'Tech YouTuber · 1.2M subs',
    avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150',
    content:
      'CreatorOS AI cut my content production time in half. The script generator alone is worth every penny — it writes hooks that actually convert.',
    rating: 5,
  },
  {
    name: 'Sofia Rodriguez',
    role: 'Lifestyle Creator · 450K subs',
    avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150',
    content:
      'The thumbnail A/B testing feature is a game changer. My CTR went from 4% to 9% in just two weeks of using the AI suggestions.',
    rating: 5,
  },
  {
    name: 'James Okoye',
    role: 'Agency Owner · 12 channels',
    avatar: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=150',
    content:
      'Managing 12 channels used to be chaos. Now with workflow automation and AI agents, my team produces 3x more content with the same headcount.',
    rating: 5,
  },
  {
    name: 'Priya Sharma',
    role: 'Education Creator · 800K subs',
    avatar: 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=150',
    content:
      'The trend research tool finds topics I never would have thought of. Three of my last five videos went viral thanks to CreatorOS AI.',
    rating: 5,
  },
];

export const FAQS = [
  {
    question: 'What is CreatorOS AI?',
    answer:
      'CreatorOS AI is an all-in-one AI-powered platform for YouTube content creators. It handles everything from trend research and script generation to thumbnail creation, video editing, SEO optimization, and automated publishing.',
  },
  {
    question: 'Do I need any technical skills to use it?',
    answer:
      'No. CreatorOS AI is designed for creators of all skill levels. The intuitive interface and AI copilot guide you through every step — from ideation to publishing.',
  },
  {
    question: 'Can I use it for multiple YouTube channels?',
    answer:
      'Yes. The Agency plan supports unlimited channels and team members. You can manage all your channels from a single dashboard with separate workspaces.',
  },
  {
    question: 'How accurate are the AI viral predictions?',
    answer:
      'Our AI models analyze millions of data points including trends, retention curves, CTR patterns, and audience behavior. While no prediction is 100% accurate, our scores give you a strong statistical edge.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Yes. We use enterprise-grade encryption, secure API connections, and never store your YouTube credentials. All data is processed in compliance with GDPR and CCPA.',
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Absolutely. You can cancel your subscription at any time from the billing settings. No hidden fees, no cancellation charges.',
  },
];

export const STATS = [
  { label: 'Creators', value: '50K+' },
  { label: 'Videos Published', value: '2.4M' },
  { label: 'AI Scripts Generated', value: '8M+' },
  { label: 'Avg. CTR Lift', value: '+47%' },
];

export const TRUSTED_BY = [
  'TechFlow',
  'CreatorHub',
  'MediaPulse',
  'GrowthLab',
  'ViralForge',
  'StudioX',
];
