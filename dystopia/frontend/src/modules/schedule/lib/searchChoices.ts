import type { ScheduleSearchFilters, ScheduleTimeBand } from "@/modules/discovery/types";
import { todayInJapan } from "@/lib/utils/japan-date";
import { INDUSTRIES, PREFECTURES, areasOf } from "@/modules/profile/lib/constants";
import { buildDateRange } from "./dates";

export type ScheduleSearchChoices = Omit<ScheduleSearchFilters, "query">;

const DAYS = 14;

export const TIME_BANDS: Array<{ id: ScheduleTimeBand; label: string }> = [
  { id: "", label: "すべて" },
  { id: "day", label: "昼（5〜18時）" },
  { id: "evening", label: "夜（18〜21時）" },
  { id: "night", label: "深夜（21時〜翌5時）" },
];

// Noon keeps every key on its own date when the device zone changes its UTC offset inside the range.
export const searchDays = () => buildDateRange(new Date(`${todayInJapan()}T12:00:00`), DAYS);

export interface SearchHome {
  prefecture: string;
  area: string;
}

const NO_HOME: SearchHome = { prefecture: "", area: "" };

const isPrefecture = (value: string) => PREFECTURES.some((p) => p === value);

export function defaultSearchChoices(home: SearchHome = NO_HOME): ScheduleSearchChoices {
  const prefecture = isPrefecture(home.prefecture) ? home.prefecture : "";
  const area = prefecture && areasOf(prefecture).includes(home.area) ? home.area : "";
  return { date: searchDays()[0], prefecture, area, industry: "", timeBand: "", followingOnly: false };
}

export function parseSearchChoices(params: Pick<URLSearchParams, "get"> | null, home: SearchHome = NO_HOME): ScheduleSearchChoices {
  const defaults = defaultSearchChoices(home);
  const date = params?.get("date") ?? "";
  const prefectureParam = params?.get("prefecture") ?? null;
  const area = params?.get("area") ?? "";
  const industry = params?.get("industry") ?? "";
  const timeBand = TIME_BANDS.find((band) => band.id === params?.get("timeBand"))?.id;

  // An empty prefecture in the URL is 全国 chosen over the profile's area, so only an absent one takes the default.
  const fromUrl = prefectureParam !== null && (prefectureParam === "" || isPrefecture(prefectureParam));
  const prefecture = fromUrl ? prefectureParam : defaults.prefecture;
  const chosenArea = fromUrl ? area : defaults.area;

  // FALLBACK: A date outside the search range, an unknown prefecture, area, industry or start band falls back to the default.
  return {
    date: searchDays().includes(date) ? date : defaults.date,
    prefecture,
    area: prefecture && areasOf(prefecture).includes(chosenArea) ? chosenArea : "",
    industry: INDUSTRIES.some((i) => i.name === industry) ? industry : defaults.industry,
    timeBand: timeBand ?? defaults.timeBand,
    followingOnly: params?.get("following") === "1",
  };
}

export function writeSearchChoices(params: URLSearchParams, choices: ScheduleSearchChoices, home: SearchHome = NO_HOME): void {
  const defaults = defaultSearchChoices(home);
  if (choices.date !== defaults.date) params.set("date", choices.date);
  if (choices.prefecture !== defaults.prefecture || choices.area !== defaults.area) {
    params.set("prefecture", choices.prefecture);
    if (choices.area) params.set("area", choices.area);
  }
  if (choices.industry !== defaults.industry) params.set("industry", choices.industry);
  if (choices.timeBand !== defaults.timeBand) params.set("timeBand", choices.timeBand);
  if (choices.followingOnly) params.set("following", "1");
}
