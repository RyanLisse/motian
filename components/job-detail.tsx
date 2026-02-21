import { Building2, MapPin, Euro, Clock, ExternalLink, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const arrangementLabels: Record<string, string> = {
  hybride: "Hybride",
  op_locatie: "Op locatie",
  remote: "Remote",
};

export function JobDetail({ job }: { job: any }) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top section */}
      <div className="bg-[#1e1e1e] rounded-xl border border-[#2d2d2d] p-6 space-y-6">
        <div>
          <div className="text-sm text-[#8e8e8e] mb-1 font-medium">{job.company || "Onbekend"}</div>
          <h1 className="text-2xl font-bold text-[#ececec]">{job.title}</h1>
          <div className="text-xs text-[#6b6b6b] mt-1 uppercase">{job.externalId || job.id.split('-')[0]}</div>
        </div>

        <div>
          <h3 className="font-semibold text-sm text-[#ececec] mb-2">Verantwoordelijkheden en taken:</h3>
          <p className="text-sm text-[#8e8e8e]">
            {job.description ? job.description.substring(0, 150) + "..." : "Geen korte omschrijving beschikbaar."}
          </p>
        </div>

        {job.applicationDeadline && (
          <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 text-xs font-semibold">
            <Clock className="w-3.5 h-3.5 mr-1.5" />
            Sluit over {Math.max(0, Math.ceil((new Date(job.applicationDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} dagen
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-y border-[#2d2d2d] text-sm">
          <div>
            <div className="text-[#6b6b6b] mb-1 flex items-center gap-1.5"><Clock className="w-4 h-4"/> Uur per week</div>
            <div className="font-medium text-[#ececec]">Niet opgegeven</div>
          </div>
          <div>
            <div className="text-[#6b6b6b] mb-1 flex items-center gap-1.5"><Calendar className="w-4 h-4"/> Startdatum</div>
            <div className="font-medium text-[#ececec]">{job.startDate ? new Date(job.startDate).toLocaleDateString("nl-NL") : "In overleg"}</div>
          </div>
          <div>
            <div className="text-[#6b6b6b] mb-1 flex items-center gap-1.5"><MapPin className="w-4 h-4"/> Locatie</div>
            <div className="font-medium text-[#ececec]">{job.location || "Niet opgegeven"}</div>
          </div>
          <div>
            <div className="text-[#6b6b6b] mb-1 flex items-center gap-1.5"><Euro className="w-4 h-4"/> Uurtarief</div>
            <div className="font-medium text-[#ececec]">
              {job.rateMin && job.rateMax ? `EUR${job.rateMin} - EUR${job.rateMax}` : job.rateMax ? `max EUR${job.rateMax}` : "Niet opgegeven"}
            </div>
          </div>
        </div>

        <div>
          <span className="text-sm font-semibold text-[#ececec] mr-3">Eisen</span>
          <div className="inline-flex flex-wrap gap-2">
            {job.platform && <Badge variant="secondary" className="font-normal bg-[#2a2a2a] text-[#8e8e8e] border-0">{job.platform}</Badge>}
            {job.workArrangement && <Badge variant="secondary" className="font-normal bg-[#2a2a2a] text-[#8e8e8e] border-0">{arrangementLabels[job.workArrangement] ?? job.workArrangement}</Badge>}
            {job.contractType && <Badge variant="secondary" className="font-normal bg-[#2a2a2a] text-[#8e8e8e] capitalize border-0">{job.contractType}</Badge>}
          </div>
        </div>
      </div>

      <div className="bg-[#1e1e1e] rounded-xl border border-[#2d2d2d] p-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-[#ececec] mb-3">Functiebeschrijving</h2>
          <div className="text-sm text-[#8e8e8e] whitespace-pre-wrap leading-relaxed">
            {job.description}
          </div>
        </div>

        {(job.requirements && Array.isArray(job.requirements) && job.requirements.length > 0) && (
          <div>
            <h2 className="text-lg font-bold text-[#ececec] mb-3">Functie-eisen</h2>
            <ul className="list-disc pl-5 space-y-1 text-sm text-[#8e8e8e]">
              {job.requirements.map((req: string, i: number) => (
                <li key={i}>{req}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Bottom action */}
      <div className="bg-[#1e1e1e] rounded-xl border border-[#2d2d2d] p-6 space-y-4">
        <h3 className="font-bold text-lg text-[#ececec]">Stel hier je kandidaat aan</h3>
        <Button className="w-full bg-[#10a37f] hover:bg-[#10a37f]/90 text-white">Reageer direct</Button>
      </div>
    </div>
  );
}
