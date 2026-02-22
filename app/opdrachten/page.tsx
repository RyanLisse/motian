import { Search } from "lucide-react";

export default function OpdrachtenPage() {
  return (
    <div className="flex-1 flex items-center justify-center bg-[#111111]">
      <div className="text-center max-w-sm px-6">
        <div className="w-16 h-16 rounded-2xl bg-[#1e1e1e] border border-[#2d2d2d] flex items-center justify-center mx-auto mb-5">
          <Search className="h-7 w-7 text-[#6b6b6b]" />
        </div>
        <h2 className="text-lg font-semibold text-[#ececec] mb-2">
          Start je zoektocht
        </h2>
        <p className="text-sm text-[#6b6b6b] leading-relaxed">
          Selecteer een opdracht uit de lijst om de details te bekijken
        </p>
      </div>
    </div>
  );
}
