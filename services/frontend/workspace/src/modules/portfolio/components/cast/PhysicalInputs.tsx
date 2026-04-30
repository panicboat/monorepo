import { ProfileFormData } from "@/modules/portfolio/types";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

interface PhysicalInputsProps {
  data: ProfileFormData;
  onChange: (key: keyof ProfileFormData, val: ProfileFormData[keyof ProfileFormData]) => void;
}

export const PhysicalInputs = ({ data, onChange }: PhysicalInputsProps) => {
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const { name, value } = e.target;
    if (name === "age" || name === "height") {
      onChange(name, value ? Number(value) : undefined);
    }
  };

  const handleSizeChange = (key: "b" | "w" | "h", value: string) => {
    onChange("threeSizes", {
      ...(data.threeSizes || { b: 0, w: 0, h: 0, cup: "" }),
      [key]: value ? Number(value) : 0,
    });
  };

  const handleCupChange = (value: string) => {
    onChange("threeSizes", {
      ...(data.threeSizes || { b: 0, w: 0, h: 0, cup: "" }),
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
        <Label className="text-xs font-bold text-text-secondary uppercase">
          Age
        </Label>
        <div className="relative">
          <Input
            type="number"
            name="age"
            value={data.age || ""}
            onChange={handleChange}
            placeholder="20"
            className="w-full font-bold focus-visible:ring-role-cast"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-text-muted pointer-events-none">
            歳
          </span>
        </div>
      </div>

      {/* Height */}
      <div className="space-y-1">
        <Label className="text-xs font-bold text-text-secondary uppercase">
          Height
        </Label>
        <div className="relative">
          <Input
            type="number"
            name="height"
            value={data.height || ""}
            onChange={handleChange}
            placeholder="160"
            className="w-full font-bold focus-visible:ring-role-cast"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-text-muted pointer-events-none">
            cm
          </span>
        </div>
      </div>

      {/* Blood Type */}
      <div className="col-span-2 space-y-1">
        <Label className="text-xs font-bold text-text-secondary uppercase">
          Blood Type
        </Label>
        <div className="flex gap-2">
          {bloodTypes.map((type) => (
            <Button
              key={type}
              type="button"
              variant={data.bloodType === type ? "default" : "outline"}
              onClick={() => onChange("bloodType", type)}
              className={`flex-1 ${data.bloodType === type
                  ? "bg-role-cast hover:bg-role-cast-hover text-white border-role-cast"
                  : "bg-surface text-text-secondary border-border hover:bg-surface-secondary"
                }`}
            >
              {type}
            </Button>
          ))}
        </div>
      </div>

      <div className="col-span-2 border-t border-border my-2" />

      {/* Measurements Header */}
      <div className="col-span-2 text-sm font-bold text-text-primary">
        Measurements
      </div>

      {/* Bust & Cup */}
      <div className="col-span-2 grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-1">
          <Label className="text-xs font-bold text-text-secondary uppercase">
            Bust
          </Label>
          <div className="relative">
            <Input
              type="number"
              value={data.threeSizes?.b || ""}
              onChange={(e) => handleSizeChange("b", e.target.value)}
              placeholder="85"
              className="w-full font-bold focus-visible:ring-role-cast"
            />
            <span className="absolute right-14 top-1/2 -translate-y-1/2 text-sm font-bold text-text-muted pointer-events-none">
              cm
            </span>
            <div className="absolute right-1 top-1/2 -translate-y-1/2 ">
              <Select
                value={data.threeSizes?.cup || ""}
                onValueChange={handleCupChange}
              >
                <SelectTrigger className="h-8 w-[60px] text-xs font-bold border-none shadow-none focus:ring-0">
                  <SelectValue placeholder="-" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="-">-</SelectItem>
                  {cups.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Waist */}
      <div className="space-y-1">
        <Label className="text-xs font-bold text-text-secondary uppercase">
          Waist
        </Label>
        <div className="relative">
          <Input
            type="number"
            value={data.threeSizes?.w || ""}
            onChange={(e) => handleSizeChange("w", e.target.value)}
            placeholder="58"
            className="w-full font-bold focus-visible:ring-role-cast"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-text-muted pointer-events-none">
            cm
          </span>
        </div>
      </div>

      {/* Hip */}
      <div className="space-y-1">
        <Label className="text-xs font-bold text-text-secondary uppercase">
          Hip
        </Label>
        <div className="relative">
          <Input
            type="number"
            value={data.threeSizes?.h || ""}
            onChange={(e) => handleSizeChange("h", e.target.value)}
            placeholder="88"
            className="w-full font-bold focus-visible:ring-role-cast"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-text-muted pointer-events-none">
            cm
          </span>
        </div>
      </div>
    </div>
  );
};
