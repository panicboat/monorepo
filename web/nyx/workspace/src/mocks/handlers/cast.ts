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
  area: "六本木, 西麻布",
  serviceCategory: "standard",
  locationType: "dispatch",
  promiseRate: 100,
  images: {
    hero: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=988&auto=format&fit=crop",
    portfolio: [
      "https://images.unsplash.com/photo-1616091093747-47804425986c?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=600&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop",
      "https://placehold.co/600x800/orange/white?text=Casual",
      "https://placehold.co/600x800/blue/white?text=Dress",
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
  weeklyShifts: [],
};

export const handlers = [
  http.get("/api/casts/:id", ({ params }) => {
    // In a real app, verify params.id. For demo, return the same mock.
    return HttpResponse.json(MOCK_PROFILE);
  }),

  // Profile Management (Phase 2)
  http.get("/api/cast/profile", () => {
    return HttpResponse.json(MOCK_PROFILE);
  }),

  http.put("/api/cast/profile", async ({ request }) => {
    const body = (await request.json()) as Partial<CastProfile>;

    // Simulate DB Update
    if (body.name) MOCK_PROFILE.name = body.name;
    if (body.tagline) MOCK_PROFILE.tagline = body.tagline;
    if (body.bio) MOCK_PROFILE.bio = body.bio;
    if (body.message) MOCK_PROFILE.message = body.message;
    if (body.area) MOCK_PROFILE.area = body.area;
    if (body.serviceCategory)
      MOCK_PROFILE.serviceCategory = body.serviceCategory;
    if (body.locationType) MOCK_PROFILE.locationType = body.locationType;
    if (body.images) MOCK_PROFILE.images = body.images;
    if (body.socialLinks) MOCK_PROFILE.socialLinks = body.socialLinks;

    // New Fields
    if (body.tags) MOCK_PROFILE.tags = body.tags;
    if (body.age) MOCK_PROFILE.age = body.age;
    if (body.height) MOCK_PROFILE.height = body.height;
    if (body.bloodType) MOCK_PROFILE.bloodType = body.bloodType;
    if (body.threeSizes) MOCK_PROFILE.threeSizes = body.threeSizes;

    return HttpResponse.json(MOCK_PROFILE);
  }),

  // Dashboard Stats
  http.get("/api/cast/stats", () => {
    return HttpResponse.json({
      earningsToday: 45000,
      earningsTodayChange: 15,
      earningsThisWeek: 180000,
      earningsThisMonth: 720000,
      reservationsThisMonth: 12,
      promiseRate: 100,
      followers: 24,
    });
  }),

  // Upcoming Reservations
  http.get("/api/cast/upcoming-reservations", () => {
    return HttpResponse.json({
      reservations: [
        {
          id: "r1",
          guestName: "panicboat",
          date: "2026-01-10",
          startTime: "19:00",
          planName: "Standard Plan",
          status: "confirmed",
          duration: 60,
          guestIcon:
            "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100&auto=format&fit=crop",
        },
        {
          id: "r2",
          guestName: "panicb0at",
          date: "2026-01-10",
          startTime: "21:00",
          planName: "Standard Plan",
          status: "confirmed",
          duration: 60,
          guestIcon:
            "https://images.unsplash.com/photo-1599566150163-29194dcaad36?q=80&w=100&auto=format&fit=crop",
        },
      ],
    });
  }),

  // Status Update
  http.put("/api/cast/status", async ({ request }) => {
    const body = (await request.json()) as { status: string };
    console.log("Updated status to:", body.status);
    return HttpResponse.json({ success: true, status: body.status });
  }),

  http.get("/api/cast/mypage", () => {
    return HttpResponse.json({
      sales: 420000,
      followers: 24,
      promiseRate: 100,
    });
  }),

  http.get("/api/cast/schedule", () => {
    return HttpResponse.json({
      // Mock schedule data (simplified)
      // 20, 21 are available. 22 is booked.
      availability: [
        { date: 20, status: "available" },
        { date: 21, status: "available" },
        { date: 22, status: "booked" },
      ],
    });
  }),

  http.post("/api/chats/:id/invitations", async ({ request }) => {
    const data = await request.json();
    console.log("Sent invitation:", data);
    return HttpResponse.json({ success: true });
  }),

  // Mock Master Data for Onboarding
  http.get("/api/cast/onboarding/master-plans", () => {
    return HttpResponse.json([
      { id: "p1", name: "Standard 60min", duration: 60, price: 10000 },
      { id: "p2", name: "VIP 90min", duration: 90, price: 25000 },
    ]);
  }),

  // Reservation Detail
  http.get("/api/cast/reservations/:id", ({ params }) => {
    const { id } = params;
    return HttpResponse.json({
      id,
      guestName: "panicboat",
      guestId: "g1",
      status: "confirmed",
      plan: "Standard 60min",
      startAt: "2026-01-10 19:00",
      endAt: "2026-01-10 20:00",
      location: "Hotel Mets Shibuya",
      address: "3-chōme-29-17 Shibuya, Tokyo",
      amount: "¥15,000",
      paymentStatus: "Authorized",
    });
  }),

  // Guest Profile
  http.get("/api/cast/guests/:id", ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: "panicboat",
      age: "30s",
      job: "IT Executive",
      visits: 12,
      lastVisit: "2025-12-20",
      trustScore: "A",
      tags: ["Gentleman", "Rich", "Wine Lover"],
      memo: "Always brings expensive wine. Prefers quiet conversation.",
      history: [
        { date: "2025-12-20", cast: "Airi", plan: "Dinner 120min" },
        { date: "2025-11-15", cast: "Yuna", plan: "Standard 60min" },
        { date: "2025-10-01", cast: "Airi", plan: "Standard 90min" },
      ],
    });
  }),
];
