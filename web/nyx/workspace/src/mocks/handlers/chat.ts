import { http, HttpResponse } from "msw";

export interface Message {
  id: string;
  senderId: string; // 'me' or castId
  content: string;
  type: "text" | "image" | "sticker" | "invitation";
  timestamp: string;
  isRead: boolean;
}

const chatHistory: Record<string, Message[]> = {
  mirei: [
    {
      id: "m1",
      senderId: "me",
      content: "久しぶり！今日の21時くらいって空いてるかな？",
      type: "text",
      timestamp: "2023-10-27T10:00:00Z",
      isRead: true,
    },
    {
      id: "m2",
      senderId: "mirei",
      content:
        "Takuyaさんお久しぶりです！💕\n21時大丈夫ですよ✨ 招待状送りますね！",
      type: "text",
      timestamp: "2023-10-27T10:05:00Z",
      isRead: true,
    },
    {
      id: "m3",
      senderId: "mirei",
      content: "invitation-id-123",
      type: "invitation",
      timestamp: "2023-10-27T10:05:05Z",
      isRead: true,
    },
  ],
  jessica: [
    {
      id: "j1",
      senderId: "jessica",
      content: "来週の金曜日なら空いてます！\n楽しみにしています🥂",
      type: "text",
      timestamp: "2023-10-27T09:00:00Z",
      isRead: false,
    },
    {
      id: "j2",
      senderId: "jessica",
      content: "image-url",
      type: "image" /* Mock image type if supported later */,
      timestamp: "2023-10-27T09:00:10Z",
      isRead: false,
    },
  ],
};

export const handlers = [
  http.get("/api/chats/:id/messages", ({ params }) => {
    const { id } = params;
    const messages = chatHistory[id as string] || [];
    return HttpResponse.json({ messages });
  }),

  http.post("/api/chats/:id/messages", async ({ request, params }) => {
    const { id } = params;
    const body = (await request.json()) as {
      content: string;
      type: Message["type"];
    };

    const newMessage: Message = {
      id: Math.random().toString(36).substring(7),
      senderId: "me",
      content: body.content,
      type: body.type || "text",
      timestamp: new Date().toISOString(),
      isRead: false,
    };

    if (!chatHistory[id as string]) {
      chatHistory[id as string] = [];
    }
    chatHistory[id as string].push(newMessage);

    return HttpResponse.json(newMessage, { status: 201 });
  }),
];
