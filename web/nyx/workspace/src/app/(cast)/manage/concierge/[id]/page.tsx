"use client";

import { SmartInvitationDrawer } from "@/modules/concierge/components/cast/SmartInvitationDrawer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MoreVertical, Search, Send, ArrowLeft, Ticket, Calendar, Sparkles } from "lucide-react";
import Link from "next/link";
import React from "react";

type Message = {
  id: number;
  sender: "me" | "guest";
  type: "text" | "invitation";
  content?: string;
  invitation?: {
    time: string;
    planName: string;
    price: number;
  };
  time: string;
  status?: "read";
};

export default function ConciergePage() {
  // Mock Messages
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: 1,
      sender: "me",
      type: "text",
      content: "こんにちは！先日はご指名ありがとうございました✨",
      time: "10:30",
    },
    {
      id: 2,
      sender: "guest",
      type: "text",
      content: "こちらこそ！楽しかったです😊 今週また行きたいんですが、空いてますか？",
      time: "10:32",
    },
    {
      id: 3,
      sender: "me",
      type: "text",
      content: "ありがとうございます！ぜひぜひ💕 今週だと金曜日の夜が空いてますよ！",
      time: "10:35",
      status: "read",
    },
  ]);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const [inputText, setInputText] = React.useState("");

  const handleSendText = () => {
    if (!inputText.trim()) return;
    const newMessage: Message = {
      id: Date.now(),
      sender: "me",
      type: "text",
      content: inputText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: "read", // Mock read immediately
    };
    setMessages([...messages, newMessage]);
    setInputText("");
  };

  const handleSendInvitation = (details: { time: string; planId: number }) => {
    const newMessage: Message = {
      id: Date.now(),
      sender: "me",
      type: "invitation",
      invitation: {
        time: details.time,
        planName: details.planId === 1 ? "90分 VIPコース" : "60分 ショート", // Mock mapping
        price: details.planId === 1 ? 35000 : 20000,
      },
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: "read",
    };
    setMessages([...messages, newMessage]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {/* Header - Custom for Chat View */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/manage/concierge" className="text-slate-400 hover:text-slate-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Avatar className="w-8 h-8">
              <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Takuya" />
              <AvatarFallback>T</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-bold text-slate-800">Takuya</p>
              <p className="text-[10px] text-green-500 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                Online
              </p>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="text-slate-400">
          <MoreVertical className="w-5 h-5" />
        </Button>
      </div>
      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}
          >
            {msg.type === "text" ? (
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.sender === "me"
                  ? "bg-gradient-to-br from-pink-500 to-rose-500 text-white rounded-br-none"
                  : "bg-white text-slate-700 rounded-bl-none border border-slate-100"
                  }`}
              >
                <p>{msg.content}</p>
                <p
                  className={`text-[10px] mt-1 text-right ${msg.sender === "me" ? "text-pink-100" : "text-slate-400"
                    }`}
                >
                  {msg.time} {msg.status === "read" && "Read"}
                </p>
              </div>
            ) : (
              /* Invitation Card */
              (<div className="max-w-[85%] bg-white rounded-2xl rounded-br-none p-0 overflow-hidden shadow-md border border-pink-100">
                <div className="bg-gradient-to-r from-pink-500 to-rose-500 p-3 flex items-center justify-between text-white">
                  <div className="flex items-center gap-2">
                    <Ticket className="w-4 h-4" />
                    <span className="font-bold text-sm">Review Invitation</span>
                  </div>
                  <span className="bg-white/20 text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                    Pending
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-pink-50 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 text-pink-500" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase">Time</p>
                      <p className="font-bold text-slate-800">{msg.invitation?.time}</p>
                      <p className="text-xs text-slate-500">本日 (Today)</p>
                    </div>
                  </div>
                  <div className="border-t border-slate-100 my-2"></div>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-slate-400 font-bold uppercase">Plan</p>
                      <p className="font-bold text-slate-800 text-sm">{msg.invitation?.planName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-pink-600 font-bold">¥{msg.invitation?.price.toLocaleString()}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="w-full text-xs h-8">
                    詳細を確認
                  </Button>
                </div>
              </div>)
            )}
          </div>
        ))}

        {/* Smart Suggestion Hint */}
        <div className="flex justify-end">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-l-2xl rounded-tr-2xl text-xs max-w-[80%] shadow-sm">
            Takuyaさんが空き状況を聞いています。<br />
            <strong>スマート招待状</strong>を送ってスムーズに日程調整しましょう！
          </div>
        </div>
        <div ref={messagesEndRef} />
      </div>
      {/* Input Area */}
      <div className="p-3 bg-white border-t border-slate-100 z-50">
        <div className="flex items-end gap-2">
          {/* Smart Invitation Trigger - Small Icon Button */}
          <SmartInvitationDrawer onSend={handleSendInvitation}>
            <Button
              size="icon"
              variant="brand"
              className="rounded-full flex-shrink-0 bg-gradient-to-r from-pink-500 to-rose-500"
            >
              <Sparkles className="w-5 h-5" />
            </Button>
          </SmartInvitationDrawer>

          <Input
            placeholder="メッセージを入力..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 bg-slate-50 border-slate-200 rounded-3xl min-h-[2.5rem]"
            onKeyDown={(e) => e.key === "Enter" && handleSendText()}
          />
          <Button
            size="icon"
            onClick={handleSendText}
            variant="ghost"
            className="rounded-full text-pink-500 hover:bg-pink-50 shrink-0"
            disabled={!inputText.trim()}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
