"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, Camera, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { PhotoUploader } from "@feature/cast";

export default function ProfileEditPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    bio: "",
    tags: [] as string[],
    photos: [] as string[],
  });

  const availableTags = [
    "#お酒飲める",
    "#タバコ吸わない",
    "#マッサージ得意",
    "#カラオケ好き",
    "#英語OK",
    "#聞き上手",
    "#Sっ気",
    "#甘えん坊",
  ];

  useEffect(() => {
    setLoading(true);
    // Fetch generic profile data (mock)
    // In a real app this would be /api/cast/profile/me
    // We are simulating fetching existing data
    setTimeout(() => {
      setFormData({
        name: "美玲",
        bio: "本日は20時から空きあります✨ 久しぶりの出勤なのでお話したいです！",
        tags: ["#お酒飲める", "#マッサージ得意", "#Sっ気"],
        photos: [
          'https://images.unsplash.com/photo-1616091093747-47804425986c?q=80&w=600&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop',
        ]
      });
      setLoading(false);
    }, 500);
  }, []);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await fetch("/api/cast/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      // Simulate network delay
      await new Promise(r => setTimeout(r, 800));
      router.push("/cast/mypage");
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const toggleTag = (tag: string) => {
    if (formData.tags.includes(tag)) {
      setFormData({ ...formData, tags: formData.tags.filter((t) => t !== tag) });
    } else {
      setFormData({ ...formData, tags: [...formData.tags, tag] });
    }
  };

  return (
    <div className="bg-slate-950 text-slate-200 min-h-screen font-sans flex justify-center pb-10">
      <div className="w-full max-w-md bg-slate-950 min-h-screen flex flex-col relative shadow-2xl">

        {/* Header */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/80 sticky top-0 z-20 backdrop-blur-md flex items-center justify-between px-4">
          <Link href="/cast/mypage" className="p-2 -ml-2 text-slate-400 hover:text-white transition">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <span className="font-bold text-white text-sm">プロフィール編集</span>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="text-yellow-500 font-bold text-sm disabled:opacity-50 flex items-center gap-1"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>保存</span>
          </button>
        </header>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-slate-700 animate-spin" />
          </div>
        ) : (
          <main className="flex-1 p-5 space-y-8">

            {/* Icon */}
            <div className="flex flex-col items-center">
              <div className="relative group cursor-pointer">
                <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-slate-700 overflow-hidden">
                  <img
                    src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200"
                    alt="icon"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  <Camera className="w-8 h-8 text-white" />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">アイコンを変更</p>
            </div>

            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-xs text-slate-500 font-bold uppercase border-b border-slate-800 pb-2">基本情報</h3>

              <div>
                <label className="text-xs text-slate-400 block mb-1">源氏名</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-white focus:outline-none focus:border-yellow-600 transition"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">自己紹介 (ひとこと)</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-white focus:outline-none focus:border-yellow-600 transition h-24 resize-none"
                />
              </div>
            </div>

            {/* Photos */}
            <div className="space-y-4">
              <h3 className="text-xs text-slate-500 font-bold uppercase border-b border-slate-800 pb-2">
                ギャラリー <span className="text-[10px] font-normal normal-case ml-1">(最大4枚)</span>
              </h3>
              <PhotoUploader
                photos={formData.photos}
                onChange={(photos) => setFormData({ ...formData, photos })}
                maxPhotos={4}
              />
            </div>

            {/* Tags */}
            <div className="space-y-4">
              <h3 className="text-xs text-slate-500 font-bold uppercase border-b border-slate-800 pb-2">タグ設定</h3>
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-full text-xs transition border ${formData.tags.includes(tag)
                      ? "bg-yellow-900/30 border-yellow-600 text-yellow-400"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600"
                      }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

          </main>
        )}
      </div>
    </div>
  );
}
