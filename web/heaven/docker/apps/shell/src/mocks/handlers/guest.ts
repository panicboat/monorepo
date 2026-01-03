import { http, HttpResponse } from 'msw'

const followingList = [
  {
    id: 'mirei',
    name: '美玲',
    status: 'Tonight',
    message: '21時から1枠空きました！誰か飲みませんか？🍷',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100',
    isOnline: false, // "Tonight" usually implies schedule, but let's say not "Online" status badge type
    badges: [{ text: 'Tonight', color: 'green' }]
  },
  {
    id: 'jessica',
    name: 'Jessica',
    status: 'Online',
    message: 'チャット返せます〜',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
    isOnline: true,
    badges: [{ text: 'Online', color: 'green' }]
  },
  {
    id: 'yuna',
    name: 'Yuna',
    status: 'Offline',
    message: 'また来週！',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100',
    isOnline: false,
    badges: [{ text: 'Offline', color: 'slate' }]
  }
];

export const handlers = [
  http.get('/api/guest/home', () => {
    return HttpResponse.json({
      following: followingList,
      onlineCount: 2
    })
  }),
]
