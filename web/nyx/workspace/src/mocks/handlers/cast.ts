import { http, HttpResponse } from "msw";
import { CastProfile } from "@/modules/portfolio/types";

// Initial Mock Data
const MOCK_PROFILE: CastProfile = {
  id: "mirei",
  name: "美玲",
  age: 24,
  height: 162,
  status: "On Air (返信早め)",
  message: "本日は20時から空きあります✨ 久しぶりの出勤なのでお話したいです！",
  tagline: "癒やしの時間をお届けします✨",
  bio: "はじめまして、美玲です。普段は都内でOLをしています。映画とカフェ巡りが大好きです。",
  images: {
    hero: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=988&auto=format&fit=crop",
    portfolio: [
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1616091093747-47804425986c?q=80&w=600&auto=format&fit=crop",
      },
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop",
      },
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=600&auto=format&fit=crop",
      },
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop",
      },
      {
        type: "image",
        url: "https://placehold.co/600x800/orange/white?text=Casual",
      },
      {
        type: "image",
        url: "https://placehold.co/600x800/blue/white?text=Dress",
      },
    ],
  },
  tags: [
    { label: "癒し系", count: 10 },
    { label: "聞き上手", count: 5 },
  ],
  socialLinks: {
    x: "mirei_nyx",
    others: [],
  },
  plans: [
    { id: "p1", name: "Standard 60", duration: 60, price: 15000 },
    { id: "p2", name: "Standard 90", duration: 90, price: 22000 },
  ],
  weeklySchedules: [],
};

export const handlers = [
  http.get("/api/casts/:id", ({ params }) => {
    // In a real app, verify params.id. For demo, return the same mock.
    return HttpResponse.json(MOCK_PROFILE);
  }),

  http.get("/api/cast/mypage", () => {
    return HttpResponse.json({
      followers: 24,
    });
  }),

  // Mock Master Data for Onboarding
  http.get("/api/cast/onboarding/master-plans", () => {
    return HttpResponse.json([
      { id: "p1", name: "Standard 60min", duration: 60, price: 10000 },
      { id: "p2", name: "VIP 90min", duration: 90, price: 25000 },
    ]);
  }),
];
