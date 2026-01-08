import { http, HttpResponse } from 'msw'

const castData = {
  id: 'mirei',
  name: '美玲',
  age: 24,
  height: 162,
  shop: 'Club VENUS (歌舞伎町)',
  status: 'On Air (返信早め)',
  message: '本日は20時から空きあります✨ 久しぶりの出勤なのでお話したいです！',
  promiseRate: 100,
  images: {
    hero: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=988&auto=format&fit=crop',
    portfolio: [
      'https://images.unsplash.com/photo-1616091093747-47804425986c?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop'
    ]
  },
  tags: [
    { label: '#写真より可愛い', count: 12 },
    { label: '#神対応', count: 8 },
    { label: '#Sっ気', count: 5 },
    { label: '#英語OK', count: 0 }
  ],
  review: {
    rating: 5,
    date: '2日前',
    comment: '写真通りの美女でした。何より、待ち合わせ場所に5分前に来てくれていて、予約のやり取りも丁寧で安心できました。リピート確定です。'
  }
}

export const handlers = [
  http.get('/api/casts/:id', ({ params }) => {
    // In a real app, verify params.id. For demo, return the same mock.
    return HttpResponse.json(castData)
  }),

  // Dashboard Stats
  http.get('/api/cast/stats', () => {
    return HttpResponse.json({
      earningsToday: 45000,
      earningsTodayChange: 15,
      earningsThisWeek: 180000,
      earningsThisMonth: 720000,
      reservationsThisMonth: 12,
      promiseRate: 100,
      followers: 24
    })
  }),

  // Upcoming Reservations
  http.get('/api/cast/upcoming-reservations', () => {
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
          guestIcon: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100&auto=format&fit=crop"
        },
        {
          id: "r2",
          guestName: "panicb0at",
          date: "2026-01-10",
          startTime: "21:00",
          planName: "Standard Plan",
          status: "confirmed",
          duration: 60,
          guestIcon: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?q=80&w=100&auto=format&fit=crop"
        }
      ]
    })
  }),

  // Status Update
  http.put('/api/cast/status', async ({ request }) => {
    const body = await request.json() as { status: string };
    console.log('Updated status to:', body.status);
    return HttpResponse.json({ success: true, status: body.status })
  }),

  http.get('/api/cast/mypage', () => {
    return HttpResponse.json({
      sales: 420000,
      followers: 24,
      promiseRate: 100
    })
  }),

  http.get('/api/cast/schedule', () => {
    return HttpResponse.json({
      // Mock schedule data (simplified)
      // 20, 21 are available. 22 is booked.
      availability: [
        { date: 20, status: 'available' },
        { date: 21, status: 'available' },
        { date: 22, status: 'booked' },
      ]
    })
  }),

  http.post('/api/chats/:id/invitations', async ({ request }) => {
    const data = await request.json()
    console.log('Sent invitation:', data)
    return HttpResponse.json({ success: true })
  }),

  // Mock Master Data for Onboarding
  http.get('/api/cast/onboarding/master-plans', () => {
    return HttpResponse.json([
      { id: "p1", name: "Standard 60min", duration: 60, price: 10000 },
      { id: "p2", name: "VIP 90min", duration: 90, price: 25000 },
    ])
  }),
]
