import { ProfileFormData } from "@/modules/portfolio/types";

interface PhysicalInputsProps {
  data: ProfileFormData;
  onChange: (key: keyof ProfileFormData, val: any) => void;
}

export const PhysicalInputs = ({ data, onChange }: PhysicalInputsProps) => {
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    // Handle nested threeSizes or root level fields
    if (name === "age" || name === "height") {
      onChange(name, value ? Number(value) : undefined);
    } else if (name === "bloodType") {
      onChange("bloodType", value);
    }
  };

  const handleSizeChange = (key: "b" | "w" | "h", value: string) => {
    onChange("threeSizes", {
      ...data.threeSizes,
      [key]: value ? Number(value) : 0,
    });
  };

  const handleCupChange = (value: string) => {
    onChange("threeSizes", {
      ...(data.threeSizes || { b: 0, w: 0, h: 0 }),
      cup: value,
    });
  };

  const cups = [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
  ];
  const bloodTypes = ["A", "B", "O", "AB", "Unknown"];

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Age */}
      <div className="space-y-1">
        <label className="text-xs font-bold text-slate-500 uppercase">
          Age
        </label>
        <div className="relative">
          <input
            type="number"
            name="age"
            value={data.age || ""}
            onChange={handleChange}
            placeholder="20"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-900 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
            歳
          </span>
        </div>
      </div>

      {/* Height */}
      <div className="space-y-1">
        <label className="text-xs font-bold text-slate-500 uppercase">
          Height
        </label>
        <div className="relative">
          <input
            type="number"
            name="height"
            value={data.height || ""}
            onChange={handleChange}
            placeholder="160"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-900 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
            cm
          </span>
        </div>
      </div>

      {/* Blood Type */}
      <div className="col-span-2 space-y-1">
        <label className="text-xs font-bold text-slate-500 uppercase">
          Blood Type
        </label>
        <div className="flex gap-2">
          {bloodTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onChange("bloodType", type)}
              className={`flex-1 rounded-lg py-2 text-sm font-bold border transition-colors ${
                data.bloodType === type
                  ? "bg-pink-500 text-white border-pink-500"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="col-span-2 border-t border-slate-100 my-2" />

      {/* Measurements Header */}
      <div className="col-span-2 text-sm font-bold text-slate-800">
        Measurements
      </div>

      {/* Bust & Cup */}
      <div className="col-span-2 grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase">
            Bust
          </label>
          <div className="relative">
            <input
              type="number"
              value={data.threeSizes?.b || ""}
              onChange={(e) => handleSizeChange("b", e.target.value)}
              placeholder="85"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-900 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
            />
            <span className="absolute right-12 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
              cm
            </span>
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <select
                value={data.threeSizes?.cup || ""}
                onChange={(e) => handleCupChange(e.target.value)}
                className="h-8 rounded bg-white text-xs font-bold text-slate-600 border border-slate-200 focus:outline-none"
              >
                <option value="">-</option>
                {cups.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Waist */}
      <div className="space-y-1">
        <label className="text-xs font-bold text-slate-500 uppercase">
          Waist
        </label>
        <div className="relative">
          <input
            type="number"
            value={data.threeSizes?.w || ""}
            onChange={(e) => handleSizeChange("w", e.target.value)}
            placeholder="58"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-900 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
          />
        </div>
      </div>

      {/* Hip */}
      <div className="space-y-1">
        <label className="text-xs font-bold text-slate-500 uppercase">
          Hip
        </label>
        <div className="relative">
          <input
            type="number"
            value={data.threeSizes?.h || ""}
            onChange={(e) => handleSizeChange("h", e.target.value)}
            placeholder="88"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-900 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
          />
        </div>
      </div>
    </div>
  );
};
